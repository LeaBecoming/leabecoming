module.exports = async (req, res) => {
  try {
    const url =
      "https://raw.githubusercontent.com/LeaBecoming/leabecoming/main/memory/x-journal.json";

    const response = await fetch(url, {
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error(`GitHub returned ${response.status}`);
    }

    const memory = await response.json();

    return res.status(200).json(memory);
  } catch (error) {
    return res.status(500).json({
      error: "Lea could not remember",
      message: error.message
    });
  }
};
