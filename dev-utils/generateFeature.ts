import { prompt } from "enquirer";
import path from "path";
import { ComponentType, generate } from "./generateController";

async function generateFeature() {
  const response: any = await prompt({
    type: "input",
    name: "name",
    message: "What would you like to name your feature?"
  });

  const { name } = response;
  const newServiceDir = path.resolve(`./src/services/${name}`);
  const newControllerDir = path.resolve(`./src/controllers/${name}`);

  generate(name, newControllerDir, ComponentType.Controller);
  generate(name, newServiceDir, ComponentType.Service);
  // generate(name, newServiceDir, ComponentType.Spec);
}

generateFeature();
