import type { ModuleParams } from "@ignored/ignition-core";
import { Text, Newline } from "ink";

export const ModuleParameters = ({
  moduleParams,
}: {
  moduleParams?: ModuleParams;
}) => {
  if (!moduleParams) {
    return null;
  }

  const params = Object.entries(moduleParams).map(([key, value]) => (
    <Text>
      <Text>
        {key}: {value}
      </Text>
      <Newline />
    </Text>
  ));

  return (
    <Text>
      <Text bold={true}>Module parameters:</Text>
      <Newline />
      {...params}
    </Text>
  );
};