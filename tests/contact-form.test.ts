import { describe, expect, it } from "vitest";
import {
  contactFormSchema,
  emptyContactForm,
  toLeadContact,
} from "@/lib/contact-form-schema";
import { FIELD_LIMITS } from "@/lib/lead-schema";

const valid = {
  fullName: "Dana Reyes",
  email: "dana@examplebuilders.test",
  businessName: "Example Builders",
  phone: "+1 555 555 0123",
  website: "examplebuilders.test",
  marketingEmail: false,
  companyWebsiteConfirm: "",
};

describe("required fields", () => {
  it("accepts a complete form", () => {
    expect(contactFormSchema.safeParse(valid).success).toBe(true);
  });

  it("requires a name, email and business name", () => {
    const result = contactFormSchema.safeParse({
      ...valid,
      fullName: "",
      email: "",
      businessName: "",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const fields = result.error.issues.map((i) => i.path[0]);
      expect(fields).toContain("fullName");
      expect(fields).toContain("email");
      expect(fields).toContain("businessName");
    }
  });

  it("rejects a malformed email with a readable message", () => {
    const result = contactFormSchema.safeParse({ ...valid, email: "not-an-email" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe("Enter a valid email address.");
    }
  });
});

describe("optional fields", () => {
  it("accepts empty strings for phone and website", () => {
    const result = contactFormSchema.safeParse({ ...valid, phone: "", website: "" });
    expect(result.success).toBe(true);
  });

  it("does not require a website to look like a URL", () => {
    // People paste "@myhandle" and "facebook.com/page" — rejecting those would
    // lose a lead over formatting we can resolve ourselves.
    expect(contactFormSchema.safeParse({ ...valid, website: "@examplebuilders" }).success).toBe(
      true,
    );
  });
});

describe("length limits", () => {
  it("rejects an over-long name rather than letting it reach the server", () => {
    const result = contactFormSchema.safeParse({
      ...valid,
      fullName: "x".repeat(FIELD_LIMITS.name + 1),
    });
    expect(result.success).toBe(false);
  });
});

describe("conversion to the lead payload", () => {
  it("trims values and drops empty optional fields", () => {
    const contact = toLeadContact({
      ...valid,
      fullName: "  Dana Reyes  ",
      phone: "   ",
      website: "",
    });
    expect(contact.fullName).toBe("Dana Reyes");
    expect(contact.phone).toBeUndefined();
    expect(contact.website).toBeUndefined();
  });

  it("keeps supplied optional values", () => {
    const contact = toLeadContact(valid);
    expect(contact.phone).toBe("+1 555 555 0123");
    expect(contact.website).toBe("examplebuilders.test");
  });
});

describe("defaults", () => {
  it("starts with marketing consent unchecked", () => {
    expect(emptyContactForm.marketingEmail).toBe(false);
  });

  it("starts with an empty honeypot", () => {
    expect(emptyContactForm.companyWebsiteConfirm).toBe("");
  });
});
