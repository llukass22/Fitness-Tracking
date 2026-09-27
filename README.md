# Form

A mobile-first gym tracker with a selectable calendar and training categories. Select a calendar day, choose exercises across any categories, and enter weights (0 for bodyweight) or cardio minutes and calories. Switch between kg and lb to convert weights for the displayed group. Click **Submit workout** to add all selected exercises to that day. Logged days have an orange dot; select one to review its exercise details. Submitting again updates that day's workout. Drafts and submitted workouts are saved separately per day in this browser and preserved when switching days or refreshing.

Run `npm start` from this folder (Node.js required; no dependency installation or build step needed).

- On this computer: http://localhost:5173
- On your phone: http://192.168.1.152:5173

The server listens on all network interfaces. Your computer must have the IP address `192.168.1.152`, and your phone must be on the same local network. If Windows Firewall prompts, allow Node.js on private networks. Stop the server with Ctrl+C. Set the `PORT` environment variable to use a different port.

Logs are saved separately in each browser, so phone and desktop entries do not sync.
