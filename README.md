# Form

A mobile-first gym tracker with a simple calendar and selectable Shoulders, Chest, Back, and Legs cards. Click a muscle group to choose its exercises and enter the weight used for each one (0 for bodyweight). Switch between kg and lb to convert weights for the displayed group. Exercise selections and weights are saved on this browser for today and preserved when switching groups or refreshing. Each new day starts a fresh log; calendar navigation only changes the calendar display.

Run `npm start` from this folder (Node.js required; no dependency installation or build step needed).

- On this computer: http://localhost:5173
- On your phone: http://192.168.1.152:5173

The server listens on all network interfaces. Your computer must have the IP address `192.168.1.152`, and your phone must be on the same local network. If Windows Firewall prompts, allow Node.js on private networks. Stop the server with Ctrl+C. Set the `PORT` environment variable to use a different port.

Logs are saved separately in each browser, so phone and desktop entries do not sync.
