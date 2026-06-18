DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_sync_pricing_from_menu_items') THEN
    CREATE TRIGGER trg_sync_pricing_from_menu_items
      AFTER INSERT OR UPDATE OR DELETE ON public.menu_items
      FOR EACH ROW EXECUTE FUNCTION public.sync_pricing_from_menu_items();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_sync_pricing_from_menu_packages') THEN
    CREATE TRIGGER trg_sync_pricing_from_menu_packages
      AFTER INSERT OR UPDATE OR DELETE ON public.menu_packages
      FOR EACH ROW EXECUTE FUNCTION public.sync_pricing_from_menu_packages();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_sync_pricing_from_menu_accordions') THEN
    CREATE TRIGGER trg_sync_pricing_from_menu_accordions
      AFTER INSERT OR UPDATE OR DELETE ON public.menu_accordions
      FOR EACH ROW EXECUTE FUNCTION public.sync_pricing_from_menu_accordions();
  END IF;
END $$;