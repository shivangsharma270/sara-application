export const sendReportEmail = async (config, result) => {
  try {
    const res = await fetch("http://localhost:3001/send-report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ config, result })
    });

    return res.ok;
  } catch (err) {
    console.error("Email error:", err);
    return false;
  }
};
