ALTER TABLE "public"."project_favorites" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."_prisma_migrations" ENABLE ROW LEVEL SECURITY;

REVOKE EXECUTE ON FUNCTION public.user_can_access_file_channel(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_can_access_file_channel(text) TO authenticated;
