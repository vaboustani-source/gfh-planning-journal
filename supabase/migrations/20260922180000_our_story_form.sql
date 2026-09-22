-- "Our Story" couple questionnaire: auto-assigned forms, couple photo uploads, seeded form.

-- 1. Forms can be auto-assigned to every new wedding.
ALTER TABLE public.forms ADD COLUMN IF NOT EXISTS auto_assign boolean NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS form_assignments_form_event_key
  ON public.form_assignments (form_id, event_id);

CREATE OR REPLACE FUNCTION public.auto_assign_forms_to_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.event_type = 'wedding' THEN
    INSERT INTO public.form_assignments (form_id, event_id, status)
    SELECT f.id, NEW.id, 'not_started' FROM public.forms f WHERE f.auto_assign
    ON CONFLICT (form_id, event_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_assign_forms ON public.events;
CREATE TRIGGER trg_auto_assign_forms
  AFTER INSERT ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.auto_assign_forms_to_event();

-- 2. Private bucket for files couples attach to forms. Path: <event_id>/<assignment_id>/<file>.
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('form-uploads', 'form-uploads', false, 26214400)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "form-uploads event members read" ON storage.objects;
CREATE POLICY "form-uploads event members read" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'form-uploads' AND (
  public.is_admin(auth.uid())
  OR EXISTS (SELECT 1 FROM public.event_users eu
             WHERE eu.user_id = auth.uid() AND eu.event_id::text = (storage.foldername(name))[1])
));

DROP POLICY IF EXISTS "form-uploads event members insert" ON storage.objects;
CREATE POLICY "form-uploads event members insert" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'form-uploads' AND (
  public.is_admin(auth.uid())
  OR EXISTS (SELECT 1 FROM public.event_users eu
             WHERE eu.user_id = auth.uid() AND eu.event_id::text = (storage.foldername(name))[1])
));

DROP POLICY IF EXISTS "form-uploads event members delete" ON storage.objects;
CREATE POLICY "form-uploads event members delete" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'form-uploads' AND (
  public.is_admin(auth.uid())
  OR EXISTS (SELECT 1 FROM public.event_users eu
             WHERE eu.user_id = auth.uid() AND eu.event_id::text = (storage.foldername(name))[1])
));

-- 3. The "Our Story" questionnaire (replaces the old website form), assigned to every wedding.
INSERT INTO public.forms (id, title, description, is_template, auto_assign, fields)
VALUES (
  'a7c3e2f0-5b1d-4c2e-9f6a-0d5e8b3c1a01',
  'Our Story',
  'Tell us about the two of you. We read every answer before your weekend. It saves as you go, so come back to it whenever.',
  true,
  true,
  $json$[
    {"id":"sec_you","type":"section","label":"You two","help":"The basics, the way you'd tell them at dinner."},
    {"id":"hometowns","type":"long_text","label":"Where are you guys from (where did you grow up)?"},
    {"id":"live_now","type":"short_text","label":"Where do you live now?","required":true},
    {"id":"work","type":"long_text","label":"What do you each do for a living?","required":true},
    {"id":"weekends","type":"long_text","label":"What are your favorite things to do on the weekends?"},
    {"id":"how_met","type":"long_text","label":"How did you meet?","help":"It's your story, so tell it any way you'd like. The more personal the better.","required":true},

    {"id":"sec_proposal","type":"section","label":"The proposal"},
    {"id":"proposal_how","type":"long_text","label":"How did the proposal happen?","required":true},
    {"id":"proposal_date","type":"date","label":"When did it happen?","required":true},
    {"id":"proposal_helpers","type":"long_text","label":"Who helped with the proposal?","help":"Please tell us there was a flash mob. If there was a photographer or videographer, shout them out here.","required":true},
    {"id":"proposal_photos","type":"file_upload","label":"Proposal photos","help":"Have any? Add them here. Phone photos are perfect."},

    {"id":"sec_ring","type":"section","label":"The ring"},
    {"id":"ring_story","type":"long_text","label":"Any special story behind the ring?","help":"Was it grandma's? Was it destiny? Was it spotted in a window?","required":true},
    {"id":"ring_maker","type":"short_text","label":"Who made it? Where did you get it?"},

    {"id":"sec_each_other","type":"section","label":"Each other","help":"One each. No peeking. (Okay, some peeking.)"},
    {"id":"special_partner1","type":"long_text","label":"What's so special about {partner1}?","help":"{partner2}, this one's yours.","required":true},
    {"id":"special_partner2","type":"long_text","label":"What's so special about {partner2}?","help":"{partner1}, this one's yours.","required":true},

    {"id":"sec_people","type":"section","label":"Your people"},
    {"id":"families","type":"long_text","label":"Tell us a little bit about your families.","help":"Big families? Loud families? Blended families? What should we expect at the wedding? We just want to know who's who and who's what, and if they're huggers.","required":true},
    {"id":"anything_else","type":"long_text","label":"Is there anything else you want to share with us?","help":"What should we be watching on Netflix? Do you watch it together? What conditioner do you use? Do you have a dog? Can we pet it? Who's the driver in the relationship? Are they a good co-pilot? Is this a lot of questions?"},

    {"id":"sec_us","type":"section","label":"You and us"},
    {"id":"how_heard","type":"dropdown","label":"How did you hear about Gilbertsville Farmhouse?","options":["Google","Instagram","TikTok or Pinterest","A friend or family member","We were guests at a wedding here","A wedding planner or vendor","The Knot, Zola, or another wedding site","A magazine or article","Other"]},
    {"id":"why_us","type":"long_text","label":"Why us?","required":true},
    {"id":"share_story","type":"yes_no","label":"Can we share your story?","help":"Sometimes we share these stories on our website and social media to inspire other couples. Is that cool with you?","required":true},
    {"id":"how_he_asked","type":"yes_no","label":"Can we submit your proposal to How He Asked (and How She Asked)?","required":true},
    {"id":"instagram_partner1","type":"short_text","label":"{partner1}'s Instagram handle","placeholder":"@"},
    {"id":"instagram_partner2","type":"short_text","label":"{partner2}'s Instagram handle","placeholder":"@"}
  ]$json$::jsonb
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.form_assignments (form_id, event_id, status)
SELECT 'a7c3e2f0-5b1d-4c2e-9f6a-0d5e8b3c1a01', e.id, 'not_started'
FROM public.events e
WHERE e.event_type = 'wedding'
ON CONFLICT (form_id, event_id) DO NOTHING;
