import { prompt } from "enquirer";
import path from "path";
import { ComponentType, generate } from "./generate";

async function generateFeature() {
  const response: any = await prompt({
    type: "input",
    name: "name",
    message: "What would you like to name your feature?"
  });

  const isSingleton: any = await prompt({
    type: "input",
    name: "isSingleton",
    message: "Should this service be a singleton? (Y/N)"
  });

  console.log(
    `You answered ${
      isSingleton.isSingleton
    } to the singleton question, but JR Is too lazy to actually make this do anything just yet.`
  );

  const { name } = response;
  const newServiceDir = path.resolve(`./src/services/${name}`);
  const newControllerDir = path.resolve(`./src/controllers`);

  generate(name, newControllerDir, ComponentType.Controller, false);
  generate(name, newServiceDir, ComponentType.Service, true);
  generate(name, newServiceDir, ComponentType.Spec, false);
}

generateFeature();
