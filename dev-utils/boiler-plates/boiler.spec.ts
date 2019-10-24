function capitalizeFirstLetter(text: string) {
  return `${text.charAt(0).toUpperCase()}${text.slice(1)}`;
}

export const getBoilerPlateSpec = (serviceName: string) => {
  const capitalizedService = capitalizeFirstLetter(serviceName);

  const boilerPlateSpec = `
  import { ${capitalizedService}Service } from "./${serviceName}.service";

  describe(${capitalizedService}Service, () => {
   it('should create', () => {
     expect(new ${capitalizedService}Service()).toBeTruthy();
   })  
  })
  `;

  return boilerPlateSpec;
};
