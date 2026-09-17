const response = await fetch("http://localhost:8000/health");

if (!response.ok) {
  throw new Error(`Backend health check failed with HTTP ${response.status}`);
}

const body = await response.json();
if (body.status !== "ok") {
  throw new Error(`Unexpected backend health payload: ${JSON.stringify(body)}`);
}

console.log("Backend health check passed.");
