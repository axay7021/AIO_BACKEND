import { FeatureNames } from '@common/enums/feature-names.enum';
import { SetMetadata } from '@nestjs/common';

export const RequireFeature = (feature: FeatureNames): MethodDecorator & ClassDecorator => {
  return SetMetadata('requiredFeature', feature);
};
