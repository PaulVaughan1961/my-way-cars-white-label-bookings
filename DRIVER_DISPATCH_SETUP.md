# Driver dispatch installation

Install in this order:

1. Run `supabase/driver-dispatch-setup.sql` once in the Supabase SQL Editor.
2. Replace `app/dashboard/page.tsx`.
3. Replace `app/driver-dashboard/page.tsx`.
4. Test locally with one test booking and one active driver.
5. Commit and sync only after the test passes.

The update adds:

- operator driver assignment and reassignment;
- Awaiting response, Accepted and Declined assignment states;
- driver Accept Job and Cannot Do It controls;
- realtime operator and driver dashboard refreshes;
- an urgent operator alert for unassigned, awaiting or declined jobs;
- driver POB, completion and payment controls.

The driver dashboard must be open to show new offers immediately. When a
driver is not watching it, use the existing Text details to driver button.
