from fastapi import APIRouter, Request, Depends, HTTPException, status
from fastapi.responses import RedirectResponse
from authlib.integrations.starlette_client import OAuth
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel, EmailStr
from typing import Optional
from uuid import UUID

from app.config import settings
from app.database import get_db
from app.repositories.user_repository import UserRepository

import logging
from sqlalchemy.exc import SQLAlchemyError
from fastapi.responses import PlainTextResponse

router = APIRouter(prefix="/auth", tags=["Authentication"])

# --- Pydantic Schemas ---
class UserSessionResponse(BaseModel):
    user_id: UUID
    email: EmailStr
    role: str
    is_profile_complete: bool
    profile_picture: Optional[str] = None

    class Config:
        from_attributes = True

# --- OAuth Setup ---
oauth = OAuth()
oauth.register(
    name='google',
    client_id=settings.GOOGLE_CLIENT_ID,
    client_secret=settings.GOOGLE_CLIENT_SECRET,
    server_metadata_url='https://accounts.google.com/.well-known/openid-configuration',
    client_kwargs={'scope': 'openid email profile'}
)

# --- Endpoints ---

@router.get("/login")
async def login(request: Request):
    """Redirects user to Google Login."""
    # Always direct Google to the backend callback living at /auth/callback on this host.
    redirect_uri = str(request.url_for("auth_callback"))
    return await oauth.google.authorize_redirect(request, redirect_uri)

logger = logging.getLogger(__name__)

@router.get("/callback")
async def auth_callback(request: Request, db: AsyncSession = Depends(get_db)):
    """Handles Google Callback, checks DB, creates session."""
    # 1) exchange code -> tokens
    try:
        token = await oauth.google.authorize_access_token(request)
    except Exception as e:
        logger.exception("OAuth token exchange failed")
        # Return a clear error for the client instead of a generic 500
        raise HTTPException(status_code=400, detail=f"OAuth Error: {str(e)}")

    # 2) get userinfo (try token first, fallback to userinfo endpoint)
    user_info = token.get("userinfo")
    try:
        if not user_info:
            user_info = await oauth.google.userinfo(token=token)
    except Exception as e:
        logger.exception("Failed to fetch userinfo")
        raise HTTPException(status_code=400, detail=f"Failed to fetch userinfo: {e}")

    email = user_info.get("email")
    google_sub = user_info.get("sub")  # Provider ID
    full_name = user_info.get("name", "Unknown")
    picture = user_info.get("picture")

    # 3) Basic validation: email and provider id are required
    if not email:
        logger.error("OAuth provider did not return email: %s", user_info)
        raise HTTPException(status_code=400, detail="OAuth provider did not return email.")
    if not google_sub:
        logger.error("OAuth provider did not return subject (sub): %s", user_info)
        raise HTTPException(status_code=400, detail="OAuth provider did not return provider id (sub).")

    repo = UserRepository(db)
    user_obj = None

    # 4) DB operations wrapped to capture SQL errors
    try:
        existing_user = await repo.get_by_email(email)
        if existing_user:
            # Link provider id if missing (pre-registered responder flow)
            if existing_user.provider_id is None:
                await repo.update_provider_id(existing_user.user_id, google_sub)
            user_obj = existing_user
        else:
            # New civilian user
            user_obj = await repo.create_civilian(
                email=email,
                provider_id=google_sub,
                full_name=full_name
            )
        # If the repo methods perform commits, fine. If not, you may need:
        # await db.commit()
    except SQLAlchemyError as db_err:
        logger.exception("Database error during OAuth callback")
        raise HTTPException(status_code=500, detail="Database error during authentication.")
    except Exception as e:
        logger.exception("Unexpected error during OAuth callback")
        raise HTTPException(status_code=500, detail=f"Unexpected error: {e}")

    # 5) ensure user_obj exists
    if not user_obj:
        logger.error("User object was not created or found after callback for email=%s", email)
        raise HTTPException(status_code=500, detail="Failed to create/find user.")

    # 6) Create Session (safe access of role)
    request.session["user_id"] = str(user_obj.user_id)
    role_name = "civilian"
    try:
        role_name = user_obj.role.name if getattr(user_obj, "role", None) else "civilian"
    except Exception:
        # role might be a relationship that wasn't loaded; default to civilian
        logger.warning("Could not read role from user object; defaulting to 'civilian' for %s", email)
        role_name = "civilian"

    request.session["role"] = role_name
    request.session["picture"] = picture

    # 7) Redirect to frontend
    return RedirectResponse(url=settings.FRONTEND_REDIRECT_URL)

@router.post("/logout")
async def logout(request: Request):
    request.session.clear()
    return {"message": "Logged out successfully"}

@router.get("/me", response_model=UserSessionResponse)
async def get_current_user(request: Request, db: AsyncSession = Depends(get_db)):
    user_id_str = request.session.get('user_id')
    if not user_id_str:
        raise HTTPException(status_code=401, detail="Not authenticated")

    repo = UserRepository(db)
    user = await repo.get_by_id(UUID(user_id_str))

    if not user:
        request.session.clear()
        raise HTTPException(status_code=401, detail="User not found")

    # Calculate Logic for Profile Completion
    # User needs Phone Number AND DOB (from Profile)
    has_phone = user.phone_number is not None
    has_dob = user.profile.date_of_birth is not None if user.profile else False
    
    is_complete = has_phone and has_dob

    role_name = user.role.name if user.role else "civilian"

    return UserSessionResponse(
        user_id=user.user_id,
        email=user.email,
        role=role_name,
        is_profile_complete=is_complete,
        profile_picture=request.session.get('picture')
    )
