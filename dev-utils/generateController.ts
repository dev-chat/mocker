import fs from "fs";
import { getBoilerPlateController } from "./boiler-plates/boiler.controller";

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
    // case ComponentType.Service:
    //   return getBoilerPlateService(name);
    // case ComponentType.Spec:
    //   return getBoilerPlateServiceSpec(name);
  }
}

export function generate(name: string, directory: string, type: ComponentType) {
  const fileName = getFileName(name, type);

  const location = `${directory}/${fileName}`;
  console.log(`Creating ${directory}...`);
  fs.mkdirSync(directory);
  console.log("Done!");
  console.log(`Creating ${fileName} in ${directory}...`);
  fs.writeFileSync(location, getTemplate(name, type));
}
