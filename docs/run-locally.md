# Run OneTickets on your computer

You don't need to be a developer for this. It runs the whole app (website, API, database and a
test inbox) on your computer, with no AWS account.

1. Install [Docker Desktop](https://www.docker.com/products/docker-desktop/) and open it. Wait
   until it says Docker is running.
2. Download the code. Either install [GitHub Desktop](https://desktop.github.com/) and clone
   `rojandhimal/onetickets`, or in a terminal run
   `git clone https://github.com/rojandhimal/onetickets.git`.
3. Open a terminal in the `onetickets` folder (in GitHub Desktop: Repository, then Open in
   Terminal) and run:

   ```sh
   docker compose up --build
   ```

   The first run downloads and builds everything and takes a few minutes. It's ready when the
   messages slow down and you see `Nest application successfully started`. Leave the window open.

4. Open these in your browser:

   | Address                                        | What it is                                                                                         |
   | ---------------------------------------------- | -------------------------------------------------------------------------------------------------- |
   | [http://localhost:3000](http://localhost:3000) | OneTickets                                                                                         |
   | [http://localhost:8025](http://localhost:8025) | Test inbox: every email the app sends lands here, including sign-in links. Nothing is really sent. |

To stop, press Ctrl+C in the terminal, or click stop in Docker Desktop. Your data is kept for next
time. To pick up new changes, pull the latest code (GitHub Desktop: Fetch origin, then Pull) and
run `docker compose up --build` again. To wipe the database and start fresh, run
`docker compose down -v`.

There is nothing to copy or configure for this. The optional settings are in [`.env.example`](../.env.example).

## Showing it to someone else

Your computer can share the site with a temporary public link through
[Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/do-more-with-tunnels/trycloudflare/), which is free:

1. Install `cloudflared` ([downloads](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/downloads/);
   on a Mac with Homebrew: `brew install cloudflared`).
2. With OneTickets running, open a second terminal and run
   `cloudflared tunnel --url http://localhost:3000`. It prints an address ending in
   `trycloudflare.com`. Anyone with that address can use the site while your computer is on and
   the command is running.
3. So that sign-in links in emails point at the public address, create a file named `.env` in the
   `onetickets` folder containing `WEB_URL=https://<the address it printed>`. Then stop OneTickets
   in the first terminal (Ctrl+C) and run `docker compose up` again.

The address changes every time you start the tunnel, and it stops when your computer sleeps. Only
the website is shared. Emails, including sign-in links, still go to your test inbox and not to the
person, so either sign in yourself and walk them through it, or copy their sign-in link from the
test inbox and send it to them. This is for demos only, not for selling real tickets.

## Why it works this way

There is no shared staging site yet: see [ADR 0014](adr/0014-local-docker-staging-later.md) and
[`infra/README.md`](../infra/README.md). The stack is defined in
[`docker-compose.yml`](../docker-compose.yml).
