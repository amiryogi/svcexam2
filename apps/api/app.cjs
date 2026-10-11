// Startup file for cPanel "Setup Node.js App" (Phusion Passenger), which loads a CommonJS entry.
// The API itself is an ES module; Passenger hooks listen(), so PORT is ignored there.
import('./dist/server.js').catch((err) => {
  console.error(err);
  process.exit(1);
});
