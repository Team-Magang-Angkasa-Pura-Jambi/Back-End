import "dotenv/config";
import http from "http";
import { app } from "./configs/app.js";

const server = http.createServer(app);

const port = 8080;
const host = "localhost";
try {
  server.listen(port, () => {
    console.log(`server is on http://${host}:${port}/api/v1`);
  });
} catch (error: any) {
  console.log(error.message);
}
