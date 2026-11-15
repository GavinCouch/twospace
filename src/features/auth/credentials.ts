import { z } from "zod";

export const emptyCredentials = {
  firstName: "",
  lastName: "",
  birthday: "",
  gender: "" as const,
  email: "",
  password: "",
  confirmPassword: "",
};

export function birthdayTodayLimit() {
  return new Date().toISOString().slice(0, 10);
}

export function credentialsSchema(mode: "sign-in" | "sign-up") {
  return z
    .object({
      firstName: z.string().trim().max(60, "Use 60 characters or fewer."),
      lastName: z.string().trim().max(60, "Use 60 characters or fewer."),
      birthday: z.string(),
      gender: z.enum(["", "woman", "man", "non-binary", "prefer-not-to-say"]),
      email: z.email("Enter a valid email address."),
      password: z.string().min(10, "Use at least 10 characters.").max(128),
      confirmPassword: z.string().max(128),
    })
    .superRefine((values, context) => {
      if (mode !== "sign-up") return;
      if (!values.firstName)
        context.addIssue({
          code: "custom",
          path: ["firstName"],
          message: "Enter your first name.",
        });
      if (!values.lastName)
        context.addIssue({
          code: "custom",
          path: ["lastName"],
          message: "Enter your last name.",
        });
      if (!z.iso.date().safeParse(values.birthday).success)
        context.addIssue({
          code: "custom",
          path: ["birthday"],
          message: values.birthday
            ? "Enter a valid birthday."
            : "Enter your birthday.",
        });
      else if (values.birthday > birthdayTodayLimit())
        context.addIssue({
          code: "custom",
          path: ["birthday"],
          message: "Birthday can’t be in the future.",
        });
      if (!values.confirmPassword || values.password !== values.confirmPassword)
        context.addIssue({
          code: "custom",
          path: ["confirmPassword"],
          message: values.confirmPassword
            ? "Passwords don’t match."
            : "Enter your password again.",
        });
    });
}

export type Credentials = z.infer<ReturnType<typeof credentialsSchema>>;

export function credentialsPayload(
  mode: "sign-in" | "sign-up",
  values: Credentials,
) {
  const credentials = { email: values.email, password: values.password };
  if (mode === "sign-in") return credentials;
  return {
    ...credentials,
    name: `${values.firstName} ${values.lastName}`,
    firstName: values.firstName,
    lastName: values.lastName,
    birthday: values.birthday,
    ...(values.gender ? { gender: values.gender } : {}),
  };
}
