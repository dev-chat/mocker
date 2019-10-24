import fs from "fs";
import { getBoilerPlateController } from "./boiler-plates/boiler.controller";
import { getBoilerPlateService } from "./boiler-plates/boiler.service";
import { getBoilerPlateSpec } from "./boiler-plates/boiler.spec";

export enum ComponentType {
  Spec = "spec",
  Service = "service",
  Controller = "controller"
}

function getFileName(name: string, type: ComponentType) {
  switch (type) {
    case ComponentType.Spec: {
      return `${name}.service.spec.ts`;
    }
    case ComponentType.Controller: {
      return `${name}.controller.ts`;
    }
    case ComponentType.Service: {
      return `${name}.service.ts`;
    }
  }
}

function getTemplate(name: string, type: ComponentType) {
  switch (type) {
    case ComponentType.Controller:
      return getBoilerPlateController(name);
    case ComponentType.Service:
      return getBoilerPlateService(name, false);
    case ComponentType.Spec:
      return getBoilerPlateSpec(name);
  }
}

export function generate(
  name: string,
  directory: string,
  type: ComponentType,
  shouldFailOnExistDir: boolean
) {
  const fileName = getFileName(name, type);

  const location = `${directory}/${fileName}`;
  console.log(`Creating ${directory}...`);
  try {
    fs.mkdirSync(directory);
  } catch (e) {
    if (e.code === "EEXIST") {
      if (shouldFailOnExistDir) {
        throw e;
      } else {
        console.log(`${directory} already exists! Skipping...`);
      }
    } else {
      console.log("Error on creating folder: ", e);
    }
  }
  console.log("Done!");
  console.log(`Creating ${fileName} in ${directory}...`);
  fs.writeFileSync(location, getTemplate(name, type));
  console.log("Done!");
}
