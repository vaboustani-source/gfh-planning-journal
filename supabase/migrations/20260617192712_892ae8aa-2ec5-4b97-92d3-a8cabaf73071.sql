
-- PART 1: guide_cards table
CREATE TABLE IF NOT EXISTS public.guide_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_key text NOT NULL UNIQUE,
  header text NOT NULL,
  body text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.guide_cards TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.guide_cards TO authenticated;
GRANT ALL ON public.guide_cards TO service_role;

ALTER TABLE public.guide_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view guide cards" ON public.guide_cards FOR SELECT USING (true);
CREATE POLICY "Admins insert guide cards" ON public.guide_cards FOR INSERT TO authenticated WITH CHECK (is_admin(auth.uid()));
CREATE POLICY "Admins update guide cards" ON public.guide_cards FOR UPDATE TO authenticated USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));
CREATE POLICY "Admins delete guide cards" ON public.guide_cards FOR DELETE TO authenticated USING (is_admin(auth.uid()));

-- PART 2: add columns to pricing_config
ALTER TABLE public.pricing_config
  ADD COLUMN IF NOT EXISTS display_category text,
  ADD COLUMN IF NOT EXISTS menu_item_id uuid,
  ADD COLUMN IF NOT EXISTS last_updated_by uuid;

-- PART 3: clear scaffolding rows (pricing_config_item_key_key unique constraint already exists, skip add)
DELETE FROM public.basics_cards;
DELETE FROM public.pricing_config;

-- PART 4: updated_at trigger function + per-table triggers
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $func$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$func$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['menu_sections','menu_items','menu_packages','menu_accordions','guide_cards','section_group_limits','basics_cards','pricing_config'] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_trigger tr
      JOIN pg_class c ON c.oid = tr.tgrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname='public' AND c.relname=t AND tr.tgname = 'set_updated_at_'||t AND NOT tr.tgisinternal
    ) THEN
      EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column()', 'set_updated_at_'||t, t);
    END IF;
  END LOOP;
END $$;

-- PART 5: pricing sync functions (NO triggers)
CREATE OR REPLACE FUNCTION public.sync_pricing_from_menu_items() RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $func$
DECLARE pricing_cat text; display_cat text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    pricing_cat := CASE NEW.section_id WHEN 'reception' THEN 'reception-items' ELSE NEW.section_id END;
    display_cat := NEW.group_label;
    INSERT INTO public.pricing_config (category,item_key,item_label,price,is_active,sort_order,display_category,menu_item_id) VALUES (pricing_cat,'mi-'||NEW.id,NEW.name,0,false,NEW.sort_order,display_cat,NEW.id);
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN DELETE FROM public.pricing_config WHERE menu_item_id = OLD.id; RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    UPDATE public.pricing_config SET item_label=NEW.name, display_category=NEW.group_label, category=CASE NEW.section_id WHEN 'reception' THEN 'reception-items' ELSE NEW.section_id END WHERE menu_item_id = NEW.id;
    RETURN NEW;
  END IF; RETURN NULL;
END; $func$;

CREATE OR REPLACE FUNCTION public.sync_pricing_from_menu_packages() RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $func$
BEGIN
  IF TG_OP = 'INSERT' THEN INSERT INTO public.pricing_config (category,item_key,item_label,price,is_active,sort_order,menu_item_id) VALUES (NEW.section_id,'mp-'||NEW.id,NEW.title,0,false,NEW.sort_order,NEW.id); RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN DELETE FROM public.pricing_config WHERE menu_item_id = OLD.id; RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN UPDATE public.pricing_config SET item_label=NEW.title, category=NEW.section_id WHERE menu_item_id = NEW.id; RETURN NEW;
  END IF; RETURN NULL;
END; $func$;

CREATE OR REPLACE FUNCTION public.sync_pricing_from_menu_accordions() RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $func$
BEGIN
  IF TG_OP = 'INSERT' THEN INSERT INTO public.pricing_config (category,item_key,item_label,price,is_active,sort_order,menu_item_id) VALUES (NEW.section_id,'ma-'||NEW.id,NEW.title,0,false,NEW.sort_order,NEW.id); RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN DELETE FROM public.pricing_config WHERE menu_item_id = OLD.id; RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN UPDATE public.pricing_config SET item_label=NEW.title, category=NEW.section_id WHERE menu_item_id = NEW.id; RETURN NEW;
  END IF; RETURN NULL;
END; $func$;
