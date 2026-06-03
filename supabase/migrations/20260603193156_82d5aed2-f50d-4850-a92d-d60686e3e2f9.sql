UPDATE public.rsvp_config
SET color_primary = '#2C3E2D',
    color_secondary = '#C9A84C',
    color_accent = '#FAF8F4'
WHERE color_primary ILIKE '#B51A00'
   OR color_secondary ILIKE '#5E30EB'
   OR color_primary ILIKE '#b51a00'
   OR color_secondary ILIKE '#5e30eb';