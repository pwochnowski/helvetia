
async function main() {
    const res = await fetch("http://localhost:8080/hello");
    const text = await res.text();
    console.log("Response from server:", text);
}

await main();
