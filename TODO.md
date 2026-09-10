ps to Deploy and Run:
Because the environment does not have interactive browser authentication or a stored CLOUDFLARE_API_TOKEN, please run the deployment commands directly in your terminal:

Apply the D1 database migration:

powershell


npx wrangler d1 execute nodra --remote --file worker/migrations/005_is_bot.sql
(If prompted, log in with npx wrangler login or provide CLOUDFLARE_API_TOKEN).

Deploy the Worker:

powershell


npx wrangler deploy
Run the first time (immediate seed): Visit or curl the admin seed endpoint:

bash


curl https://acgame.win/api/admin/seed-bots