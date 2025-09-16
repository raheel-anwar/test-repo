import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Control, Controller, useForm } from "react-hook-form";

interface KeyValueObjectInputProps<T extends Record<string, any>> {
  control: Control<T>;
  name: string; // path to the object in the form, e.g., "data"
  label?: string;
}

export function KeyValueObjectInput<T extends Record<string, any>>({
  control,
  name,
  label,
}: KeyValueObjectInputProps<T>) {
  const [keys, setKeys] = useState<string[]>([]);

  const addKey = () => {
    const newKey = `key${keys.length + 1}`;
    setKeys([...keys, newKey]);
  };

  const removeKey = (keyToRemove: string) => {
    setKeys(keys.filter((k) => k !== keyToRemove));
    control.setValue(`${name}.${keyToRemove}`, undefined);
  };

  return (
    <div className="space-y-4">
      {label && <h3 className="text-lg font-medium">{label}</h3>}

      {keys.map((key) => (
        <Card key={key} className="p-4 flex items-center space-x-2">
          {/* Key field */}
          <FormField
            control={control}
            name={`${name}.${key}`}
            render={({ field }) => (
              <FormItem className="flex-1 flex flex-col">
                <FormLabel>{key}</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button variant="destructive" size="sm" onClick={() => removeKey(key)}>
            Remove
          </Button>
        </Card>
      ))}

      <Button type="button" onClick={addKey}>
        Add Key
      </Button>
    </div>
  );
}
