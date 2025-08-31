import type { Schema } from "../../data/resource";

export const handler: Schema["importSounds"]["functionHandler"] = async (event) => {
  const { fileContent } = event.arguments;
  console.log("Import received:", fileContent);

  // TODO: parse JSON, valider, batch write dans DynamoDB Sounds
  return true;
};
