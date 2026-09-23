-- Venue Contract wording fixes approved by Victoria (Sept 23 2026).
-- The previous wording is kept automatically in contract_template_versions.
UPDATE public.contract_templates
SET body = replace(replace(replace(replace(replace(body,
      '(See paragraph "G")', '(See Section 3)'),
      'Smoking is prohibited inside all building,', 'Smoking is prohibited inside all buildings,'),
      'A formal after-party extents this requirement', 'A formal after-party extends this requirement'),
      'Lodging room rates ate subject', 'Lodging room rates are subject'),
      'To further clarify, off-site may not be on site', 'To further clarify, off-site guests may not be on site'),
    updated_at = now()
WHERE name = 'Gilbertsville Farmhouse Venue Contract';
