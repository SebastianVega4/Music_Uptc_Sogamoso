-- Tablas para la sección "Buitres"

-- 1. Tabla de Personas
CREATE TABLE IF NOT EXISTS buitres_people (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    image_url TEXT,
    likes_count INTEGER DEFAULT 0,
    dislikes_count INTEGER DEFAULT 0,
    is_merged BOOLEAN DEFAULT FALSE,
    merged_into UUID REFERENCES buitres_people(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Migración: Añadir columna gender si no existe
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='buitres_people' AND column_name='gender') THEN
        ALTER TABLE buitres_people ADD COLUMN gender TEXT CHECK (gender IN ('male', 'female'));
    END IF;
END $$;

-- 2. Tabla de Detalles (Crowdsourced Tags)
CREATE TABLE IF NOT EXISTS buitres_details (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    person_id UUID REFERENCES buitres_people(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    occurrence_count INTEGER DEFAULT 1,
    is_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(person_id, content)
);

-- 3. Tabla de Comentarios
CREATE TABLE IF NOT EXISTS buitres_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    person_id UUID REFERENCES buitres_people(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    author_fingerprint TEXT NOT NULL,
    likes_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Registro de huellas para controlar votos/likes
CREATE TABLE IF NOT EXISTS buitres_interactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    target_id UUID NOT NULL, -- person_id, comment_id, or detail_id
    target_type TEXT NOT NULL, -- 'person_like', 'person_dislike', 'comment_like', 'detail_increment'
    author_fingerprint TEXT NOT NULL,
    content_snapshot TEXT, -- Requerido para detail_increment
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(target_id, target_type, author_fingerprint, content_snapshot)
);

-- Migración: Añadir content_snapshot si no existe
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='buitres_interactions' AND column_name='content_snapshot') THEN
        ALTER TABLE buitres_interactions ADD COLUMN content_snapshot TEXT;
    END IF;
END $$;

-- RLS (Row Level Security)
ALTER TABLE buitres_people ENABLE ROW LEVEL SECURITY;
ALTER TABLE buitres_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE buitres_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE buitres_interactions ENABLE ROW LEVEL SECURITY;

-- Políticas: Lectura pública para todos
DROP POLICY IF EXISTS "Public read for people" ON buitres_people;
CREATE POLICY "Public read for people" ON buitres_people FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public read for details" ON buitres_details;
CREATE POLICY "Public read for details" ON buitres_details FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public read for comments" ON buitres_comments;
CREATE POLICY "Public read for comments" ON buitres_comments FOR SELECT USING (true);

-- Políticas: Inserción pública
DROP POLICY IF EXISTS "Anons can create people" ON buitres_people;
CREATE POLICY "Anons can create people" ON buitres_people FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Anons can comment" ON buitres_comments;
CREATE POLICY "Anons can comment" ON buitres_comments FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Anons can add details" ON buitres_details;
CREATE POLICY "Anons can add details" ON buitres_details FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Anons can interact" ON buitres_interactions;
CREATE POLICY "Anons can interact" ON buitres_interactions FOR INSERT WITH CHECK (true);

-- Admin: Todo el poder
-- Nota: La lógica de admin se maneja vía JWT en el service si es necesario, 
-- o añadiendo políticas específicas para roles autenticados.

-- 5. Función para votar (Like/Dislike) anónimamente - AHORA TOGGLEABLE
CREATE OR REPLACE FUNCTION vote_person(p_person_id UUID, p_type TEXT, p_fingerprint TEXT)
RETURNS void AS $$
DECLARE
    v_existing_type TEXT;
    v_target_type TEXT := 'person_' || p_type;
BEGIN
    -- Buscar si ya existe una interacción de este usuario con esta persona
    SELECT target_type INTO v_existing_type 
    FROM buitres_interactions 
    WHERE target_id = p_person_id 
      AND author_fingerprint = p_fingerprint 
      AND (target_type = 'person_like' OR target_type = 'person_dislike');

    IF v_existing_type IS NOT NULL THEN
        -- Si es el MISMO tipo, quitamos el voto (Toggle off)
        IF v_existing_type = v_target_type THEN
            DELETE FROM buitres_interactions 
            WHERE target_id = p_person_id 
              AND author_fingerprint = p_fingerprint 
              AND target_type = v_target_type;
            
            IF p_type = 'like' THEN
                UPDATE buitres_people SET likes_count = GREATEST(0, likes_count - 1) WHERE id = p_person_id;
            ELSE
                UPDATE buitres_people SET dislikes_count = GREATEST(0, dislikes_count - 1) WHERE id = p_person_id;
            END IF;
        ELSE
            -- Si es un tipo DIFERENTE, cambiamos el voto
            UPDATE buitres_interactions 
            SET target_type = v_target_type 
            WHERE target_id = p_person_id 
              AND author_fingerprint = p_fingerprint 
              AND target_type = v_existing_type;

            IF p_type = 'like' THEN
                UPDATE buitres_people SET 
                    likes_count = likes_count + 1,
                    dislikes_count = GREATEST(0, dislikes_count - 1)
                WHERE id = p_person_id;
            ELSE
                UPDATE buitres_people SET 
                    dislikes_count = dislikes_count + 1,
                    likes_count = GREATEST(0, likes_count - 1)
                WHERE id = p_person_id;
            END IF;
        END IF;
    ELSE
        -- Si NO existe, insertamos nuevo
        INSERT INTO buitres_interactions (target_id, target_type, author_fingerprint)
        VALUES (p_person_id, v_target_type, p_fingerprint);

        IF p_type = 'like' THEN
            UPDATE buitres_people SET likes_count = likes_count + 1 WHERE id = p_person_id;
        ELSE
            UPDATE buitres_people SET dislikes_count = dislikes_count + 1 WHERE id = p_person_id;
        END IF;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Función para incrementar/crear un detalle (Etiqueta) - AHORA CON CONTROL DE HUELLA
CREATE OR REPLACE FUNCTION increment_detail(p_person_id UUID, p_content TEXT, p_fingerprint TEXT)
RETURNS void AS $$
BEGIN
    -- Verificar si el usuario ya incrementó esta etiqueta específica
    IF EXISTS (
        SELECT 1 FROM buitres_interactions 
        WHERE target_id = p_person_id 
          AND author_fingerprint = p_fingerprint 
          AND target_type = 'detail_increment'
          AND content_snapshot = p_content
    ) THEN
        -- Si ya existe, de momento no hacemos nada (o podríamos quitar el incremento, pero las etiquetas suelen ser acumulativas)
        -- Para que sea como un "like" de etiqueta, podríamos borrarlo si se hace clic de nuevo:
        DELETE FROM buitres_interactions 
        WHERE target_id = p_person_id 
          AND author_fingerprint = p_fingerprint 
          AND target_type = 'detail_increment'
          AND content_snapshot = p_content;

        UPDATE buitres_details 
        SET occurrence_count = GREATEST(0, occurrence_count - 1),
            is_verified = CASE WHEN (occurrence_count - 1) >= 10 THEN TRUE ELSE FALSE END
        WHERE person_id = p_person_id AND content = p_content;
        
        RETURN;
    END IF;

    -- Registrar la interacción
    INSERT INTO buitres_interactions (target_id, target_type, author_fingerprint, content_snapshot)
    VALUES (p_person_id, 'detail_increment', p_fingerprint, p_content);

    -- Insertar o Incrementar el detalle
    INSERT INTO buitres_details (person_id, content, occurrence_count)
    VALUES (p_person_id, p_content, 1)
    ON CONFLICT (person_id, content) 
    DO UPDATE SET 
        occurrence_count = buitres_details.occurrence_count + 1,
        is_verified = CASE WHEN buitres_details.occurrence_count + 1 >= 10 THEN TRUE ELSE FALSE END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Habilitar Realtime para las tablas de Buitres
-- Nota: Esto debe ejecutarse en el editor SQL de Supabase. 
-- Si hay errores aquí es porque la publicación 'supabase_realtime' ya existe o no tienes permisos, 
-- pero normalmente funciona en proyectos estándar.
alter publication supabase_realtime add table buitres_people;
alter publication supabase_realtime add table buitres_details;
alter publication supabase_realtime add table buitres_comments;

-- 7. Función para fusionar personas (ADMIN ONLY)
CREATE OR REPLACE FUNCTION merge_buitres(p_keep_id UUID, p_remove_id UUID)
RETURNS void AS $$
BEGIN
    -- Mover comentarios
    UPDATE buitres_comments SET person_id = p_keep_id WHERE person_id = p_remove_id;
    
    -- Mover interacciones
    UPDATE buitres_interactions SET target_id = p_keep_id WHERE target_id = p_remove_id;

    -- Mover/Combinar detalles
    -- Nota: Esto es más complejo si hay colisiones, pero por simplicidad:
    INSERT INTO buitres_details (person_id, content, occurrence_count, is_verified)
    SELECT p_keep_id, content, occurrence_count, is_verified 
    FROM buitres_details WHERE person_id = p_remove_id
    ON CONFLICT (person_id, content) 
    DO UPDATE SET 
        occurrence_count = buitres_details.occurrence_count + excluded.occurrence_count,
        is_verified = CASE WHEN (buitres_details.occurrence_count + excluded.occurrence_count) >= 10 THEN TRUE ELSE FALSE END;

    -- Marcar como fusionado
    UPDATE buitres_people SET is_merged = TRUE, merged_into = p_keep_id WHERE id = p_remove_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Vista para estadísticas y ordenamiento mejorado
CREATE OR REPLACE VIEW buitres_stats AS
SELECT 
    p.*,
    (SELECT COUNT(*) FROM buitres_comments c WHERE c.person_id = p.id) as comments_count,
    (SELECT COUNT(*) FROM buitres_details d WHERE d.person_id = p.id) as tags_count,
    (SELECT COALESCE(SUM(occurrence_count), 0) FROM buitres_details d WHERE d.person_id = p.id) as total_interactions
FROM buitres_people p
WHERE p.is_merged = FALSE;

-- Otorgar permisos a la vista para que sea legible públicamente
GRANT SELECT ON buitres_stats TO anon, authenticated;
