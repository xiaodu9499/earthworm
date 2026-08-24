create policy "No direct access to learning administrator allowlist"
on private.learning_admins
as restrictive
for all
to public
using (false)
with check (false);
