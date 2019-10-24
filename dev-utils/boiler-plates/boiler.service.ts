function capitalizeFirstLetter(text: string) {
  return `${text.charAt(0).toUpperCase()}${text.slice(1)}`;
}

export const getBoilerPlateService = (
  serviceName: string,
  isSingleton: boolean
) => {
  const capitalizedService = capitalizeFirstLetter(serviceName);

  const boilerPlateServiceSingleton = `
  export class ${capitalizedService}Service {
    public static getInstance() {
      if(!${capitalizedService}Service.instance) {
        ${capitalizedService}Service.instance = new ${capitalizedService}Service();
      }
      return ${capitalizedService}Service.instance;
    }

    private static instance: ${capitalizedService};

    private constructor() {};
  }
  `;

  const boilerPlateServiceNonSingleton = `
  export class ${capitalizedService}Service {
    public constructor() {};
  }
  `;

  return isSingleton
    ? boilerPlateServiceSingleton
    : boilerPlateServiceNonSingleton;
};
