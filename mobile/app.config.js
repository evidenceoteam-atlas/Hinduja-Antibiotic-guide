const fs = require("fs");
const path = require("path");

const { expo } = require("./app.json");

const dotenvFiles = [
  path.resolve(__dirname, "../.env"),
  path.resolve(__dirname, "../.env.local"),
  path.resolve(__dirname, ".env"),
  path.resolve(__dirname, ".env.local"),
];

const parseDotenv = (contents) => {
  const parsed = {};

  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line || line.startsWith("#")) {
      continue;
    }

    const equalsIndex = line.indexOf("=");

    if (equalsIndex === -1) {
      continue;
    }

    const key = line.slice(0, equalsIndex).trim();
    let value = line.slice(equalsIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    parsed[key] = value;
  }

  return parsed;
};

const fileEnv = dotenvFiles.reduce((accumulator, filePath) => {
  if (!fs.existsSync(filePath)) {
    return accumulator;
  }

  return {
    ...accumulator,
    ...parseDotenv(fs.readFileSync(filePath, "utf8")),
  };
}, {});

for (const [key, value] of Object.entries(fileEnv)) {
  if (process.env[key] === undefined) {
    process.env[key] = value;
  }
}

module.exports = {
  expo: {
    ...expo,
    extra: {
      ...(expo.extra ?? {}),
      supabaseEnv: {
        hasUrl: Boolean(process.env.EXPO_PUBLIC_SUPABASE_URL),
        hasAnonKey: Boolean(process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY),
      },
    },
  },
};
