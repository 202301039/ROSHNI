-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS postgis;

------------------------------------------------------------
-- 1. User Management
------------------------------------------------------------

-- 1.1 Role
CREATE TABLE roles (
    role_id SMALLINT PRIMARY KEY,                -- e.g. 1=civilian, 2=responder, 3=commander
    name VARCHAR(50) UNIQUE NOT NULL,
    description TEXT
);

-- 1.2 User
CREATE TABLE users (
    user_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    role_id SMALLINT NOT NULL REFERENCES roles(role_id),
    phone_number VARCHAR(20) UNIQUE,
    email VARCHAR(255) UNIQUE,
    provider_id VARCHAR(255),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_known_location GEOMETRY(Point, 4326),
    last_location_at TIMESTAMPTZ
);

-- 1.3 UserProfile (PII)
CREATE TABLE user_profiles (
    user_id UUID PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
    full_name VARCHAR(255) NOT NULL,
    date_of_birth DATE,
    address TEXT,
    emergency_contact_name VARCHAR(255),
    emergency_contact_phone VARCHAR(20)
);

-- 1.4 UserMedicalProfile
CREATE TABLE user_medical_profiles (
    user_id UUID PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
    public_user_code VARCHAR(50) NOT NULL UNIQUE,
    blood_group VARCHAR(5),
    known_allergies TEXT,
    chronic_conditions TEXT,
    current_medications TEXT,
    other_medical_notes TEXT,
    consent_flags JSONB NOT NULL DEFAULT '{}'::jsonb
);

------------------------------------------------------------
-- 2. Responder Management
------------------------------------------------------------

-- 2.1 Team
CREATE TABLE teams (
    team_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    team_type VARCHAR(30) NOT NULL,
    commander_user_id UUID REFERENCES users(user_id) ON DELETE SET NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'available',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT ck_team_type
        CHECK (team_type IN ('medic', 'fire', 'police', 'mixed', 'disaster_response')),
    CONSTRAINT ck_team_status
        CHECK (status IN ('available', 'deployed', 'offline'))
);

-- 2.2 ResponderProfile
CREATE TABLE responder_profiles (
    user_id UUID PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
    team_id UUID REFERENCES teams(team_id) ON DELETE SET NULL,
    responder_type VARCHAR(30) NOT NULL,
    badge_number VARCHAR(50),
    government_id_number VARCHAR(100),
    qualifications TEXT,
    created_by_commander_id UUID REFERENCES users(user_id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    team_joined_at TIMESTAMPTZ,
    CONSTRAINT ck_responder_type
        CHECK (responder_type IN ('medic', 'firefighter', 'police', 'disaster_responder', 'logistician')),
    CONSTRAINT ck_responder_status
        CHECK (status IN ('active', 'suspended', 'retired'))
);

------------------------------------------------------------
-- 3. Incidents, Disasters & Tasks
------------------------------------------------------------

-- 3.1 Incident
CREATE TABLE incidents (
    incident_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reported_by_user_id UUID REFERENCES users(user_id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    incident_type VARCHAR(50), -- 'flood' | 'accident' | 'fire' | 'earthquake' | 'other'
    location GEOMETRY(Point, 4326) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'open', -- 'open' | 'converted' | 'discarded'
    reported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT ck_incident_status
        CHECK (status IN ('open', 'converted', 'discarded'))
);

-- 3.2 IncidentMedia
CREATE TABLE incident_media (
    media_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    incident_id UUID NOT NULL REFERENCES incidents(incident_id) ON DELETE CASCADE,
    uploaded_by_user_id UUID REFERENCES users(user_id) ON DELETE SET NULL,
    file_type VARCHAR(20) NOT NULL,      -- 'image' | 'video' | 'audio' | 'document'
    mime_type VARCHAR(100),
    storage_path VARCHAR(1024) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT ck_incident_media_file_type
        CHECK (file_type IN ('image', 'video', 'audio', 'document'))
);

-- 3.3 Disaster
CREATE TABLE disasters (
    disaster_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reported_by_user_id UUID REFERENCES users(user_id) ON DELETE SET NULL,
    source_incident_id UUID REFERENCES incidents(incident_id) ON DELETE SET NULL,
    commander_user_id UUID REFERENCES users(user_id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(30) NOT NULL DEFAULT 'active',
    disaster_type VARCHAR(50),        -- 'flood', 'fire', 'earthquake', etc.
    severity_level VARCHAR(20),       -- 'low' | 'medium' | 'high' | 'critical'
    estimated_injuries INTEGER,
    estimated_casualties INTEGER,
    location GEOMETRY(Point, 4326) NOT NULL,
    affected_area GEOMETRY(Polygon, 4326),
    reported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMPTZ,
    CONSTRAINT ck_disaster_status
        CHECK (status IN ('active', 'under_investigation', 'ongoing',
                          'contained', 'resolved', 'false_alarm')),
    CONSTRAINT ck_disaster_severity
        CHECK (severity_level IN ('low', 'medium', 'high', 'critical')
               OR severity_level IS NULL)
);

-- 3.4 DisasterTask
CREATE TABLE disaster_tasks (
    task_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    disaster_id UUID NOT NULL REFERENCES disasters(disaster_id) ON DELETE CASCADE,
    created_by_commander_id UUID NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
    task_type VARCHAR(30) NOT NULL, -- 'medic' | 'fire' | 'police' | 'logistics' | 'search_rescue' | 'evacuation' | 'other'
    description TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- 'pending' | 'in_progress' | 'completed' | 'cancelled'
    priority VARCHAR(20) DEFAULT 'medium',         -- 'low' | 'medium' | 'high'
    location GEOMETRY(Point, 4326),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT ck_disaster_task_status
        CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
    CONSTRAINT ck_disaster_task_priority
        CHECK (priority IN ('low', 'medium', 'high'))
);

-- 3.5 DisasterTaskAssignment
CREATE TABLE disaster_task_assignments (
    task_id UUID NOT NULL REFERENCES disaster_tasks(task_id) ON DELETE CASCADE,
    team_id UUID NOT NULL REFERENCES teams(team_id) ON DELETE CASCADE,
    assigned_by_user_id UUID REFERENCES users(user_id) ON DELETE SET NULL,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status VARCHAR(20) NOT NULL DEFAULT 'assigned', -- 'assigned' | 'en_route' | 'on_scene' | 'completed' | 'cancelled'
    eta TIMESTAMPTZ,
    arrived_at TIMESTAMPTZ,
    released_at TIMESTAMPTZ,
    PRIMARY KEY (task_id, team_id),
    CONSTRAINT ck_disaster_task_assignment_status
        CHECK (status IN ('assigned', 'en_route', 'on_scene', 'completed', 'cancelled'))
);

------------------------------------------------------------
-- 4. Following, Questions, Logs, Media & Chat
------------------------------------------------------------

-- 4.1 DisasterFollower
CREATE TABLE disaster_followers (
    disaster_id UUID NOT NULL REFERENCES disasters(disaster_id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    followed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (disaster_id, user_id)
);

-- 4.2 QuestionTemplate
CREATE TABLE question_templates (
    question_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key VARCHAR(100) NOT NULL UNIQUE,      -- e.g. 'new_casualties', 'medics_sufficient'
    question_text TEXT NOT NULL,
    answer_type VARCHAR(20) NOT NULL,      -- 'boolean' | 'integer' | 'text' | 'choice'
    metadata JSONB,
    is_active INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT ck_question_answer_type
        CHECK (answer_type IN ('boolean', 'integer', 'text', 'choice'))
);

-- 4.3 DisasterQuestionState
CREATE TABLE disaster_question_states (
    disaster_id UUID NOT NULL REFERENCES disasters(disaster_id) ON DELETE CASCADE,
    question_id UUID NOT NULL REFERENCES question_templates(question_id) ON DELETE CASCADE,
    last_answer_value TEXT,                   -- could be JSONB if needed later
    last_answered_at TIMESTAMPTZ,
    last_answered_by_user_id UUID REFERENCES users(user_id) ON DELETE SET NULL,
    PRIMARY KEY (disaster_id, question_id)
);

-- 4.4 DisasterLog
CREATE TABLE disaster_logs (
    log_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    disaster_id UUID NOT NULL REFERENCES disasters(disaster_id) ON DELETE CASCADE,
    created_by_user_id UUID REFERENCES users(user_id) ON DELETE SET NULL,
    source_type VARCHAR(20) NOT NULL,   -- 'user_input' | 'tweet' | 'news_article' | 'sensor' | 'system' | 'question_answer'
    title VARCHAR(255),
    text_body TEXT,
    num_deaths INTEGER,
    num_injuries INTEGER,
    estimated_damage_cost NUMERIC(20,2),
    estimated_resource_cost NUMERIC(20,2),
    firefighter_required INTEGER,
    medic_required INTEGER,
    police_required INTEGER,
    help_required INTEGER,
    food_required_for_people INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT ck_disaster_log_source_type
        CHECK (source_type IN ('user_input', 'tweet', 'news_article', 'sensor', 'system', 'question_answer'))
);

-- 4.5 DisasterMedia
CREATE TABLE disaster_media (
    media_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    log_id UUID NOT NULL REFERENCES disaster_logs(log_id) ON DELETE CASCADE,
    uploaded_by_user_id UUID REFERENCES users(user_id) ON DELETE SET NULL,
    file_type VARCHAR(20) NOT NULL,      -- 'image' | 'video' | 'audio' | 'document'
    mime_type VARCHAR(100),
    storage_path VARCHAR(1024) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT ck_disaster_media_file_type
        CHECK (file_type IN ('image', 'video', 'audio', 'document'))
);

-- 4.6 DisasterChatMessage
CREATE TABLE disaster_chat_messages (
    message_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    disaster_id UUID NOT NULL REFERENCES disasters(disaster_id) ON DELETE CASCADE,
    -- team_id intentionally has no FK; it may reference external/opaque IDs
    team_id UUID,
    sender_user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    message_text TEXT NOT NULL,
    is_global BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

------------------------------------------------------------
-- 5. Mapping & Real-time Tracking
------------------------------------------------------------

-- 5.1 MapSite
CREATE TABLE map_sites (
    site_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    site_type VARCHAR(50) NOT NULL,  -- 'safe_zone' | 'hospital' | 'police_station' | 'shelter' | 'food_depot' | 'critical_infrastructure'
    location GEOMETRY(Point, 4326) NOT NULL,
    capacity INTEGER,
    current_occupancy INTEGER,
    status VARCHAR(20) NOT NULL DEFAULT 'open', -- 'open' | 'full' | 'closed' | 'damaged'
    contact_phone VARCHAR(20),
    metadata JSONB,
    CONSTRAINT ck_map_site_type
        CHECK (site_type IN ('safe_zone', 'hospital', 'police_station',
                             'shelter', 'food_depot', 'critical_infrastructure')),
    CONSTRAINT ck_map_site_status
        CHECK (status IN ('open', 'full', 'closed', 'damaged'))
);

-- 5.2 UserLocationLog
CREATE TABLE user_location_logs (
    location_log_id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    location GEOMETRY(Point, 4326) NOT NULL,
    logged_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

------------------------------------------------------------
-- 6. Draft Reports
------------------------------------------------------------

-- 6.1 DisasterReportDraft
CREATE TABLE disaster_report_drafts (
    report_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    disaster_id UUID NOT NULL REFERENCES disasters(disaster_id) ON DELETE CASCADE,
    created_by_user_id UUID REFERENCES users(user_id) ON DELETE SET NULL,
    version_number INTEGER NOT NULL,
    generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status VARCHAR(20) NOT NULL DEFAULT 'draft', -- 'draft' | 'final'
    disaster_name_snapshot VARCHAR(255),
    estimated_deaths INTEGER,
    estimated_casualties INTEGER,
    resources_used_summary TEXT,
    damage_summary TEXT,
    timeline_json JSONB,
    pdf_storage_path VARCHAR(1024),
    CONSTRAINT uq_disaster_report_version
        UNIQUE (disaster_id, version_number),
    CONSTRAINT ck_disaster_report_status
        CHECK (status IN ('draft', 'final'))
);
