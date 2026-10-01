# Form

A mobile-first gym tracker with a selectable calendar and training categories. Select a calendar day, choose exercises across any categories, and enter weights (0 for bodyweight) or cardio minutes and calories. Switch between kg and lb to convert weights for the displayed group. Click **Submit workout** to add all selected exercises to that day. Logged days have an orange dot; select one to review its exercise details. Submitting again updates that day's workout. Drafts and submitted workouts are saved separately per day in this browser and preserved when switching days or refreshing.

To remove an entry, select its calendar day and click **Remove** beside the exercise in the workout details. This also clears that exercise from the day's draft. Removing the last entry clears the day's calendar dot.

Choose **Custom** to enter any exercise name with Weight and Sets. Use **Add exercise** for additional rows, and deselect any row you do not want to submit. Custom exercises support kg/lb conversion and are saved in that day's draft and submitted workout alongside the other categories.

Weekly workout progress shows the Monday–Sunday week containing the selected calendar day, with a goal of 3 days. Each day with at least one submitted exercise counts once: 0, 1, 2, and 3 days show 0%, 33%, 67%, and 100%; additional days stay at 100%. Drafts do not count. Progress is calculated from the existing submitted workouts and updates with a smooth fill transition after submitting or removing exercises (respecting reduced-motion settings).

Run `npm start` from this folder (Node.js required; no dependency installation or build step needed).

- On this computer: http://localhost:5173
- On your phone: http://192.168.1.152:5173

The server listens on all network interfaces. Your computer must have the IP address `192.168.1.152`, and your phone must be on the same local network. If Windows Firewall prompts, allow Node.js on private networks. Stop the server with Ctrl+C. Set the `PORT` environment variable to use a different port.

Logs are saved separately in each browser, so phone and desktop entries do not sync.
