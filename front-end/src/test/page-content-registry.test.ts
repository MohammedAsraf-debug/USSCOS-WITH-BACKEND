import { describe, expect, it } from "vitest";
import {
  CONTENT_PAGES,
  blockDefaults,
  getContentPage,
} from "@/features/admin/content-pages.js";
import { PAGE_CONTENT } from "@/data/pageContent.js";

describe("website content registry", () => {
  it("every block maps to a known content block with defaults", () => {
    for (const page of CONTENT_PAGES) {
      for (const block of page.blocks) {
        expect(
          PAGE_CONTENT[block.id],
          `missing defaults for block "${block.id}"`,
        ).toBeDefined();
      }
    }
  });

  it("every editable field key exists in the block defaults", () => {
    for (const page of CONTENT_PAGES) {
      for (const block of page.blocks) {
        const defaults = blockDefaults(block.id);
        for (const field of block.fields) {
          expect(
            Object.prototype.hasOwnProperty.call(defaults, field.key),
            `${block.id}.${field.key} has no default`,
          ).toBe(true);
        }
      }
    }
  });

  it("every list defaults to an array whose items expose the item fields", () => {
    for (const page of CONTENT_PAGES) {
      for (const block of page.blocks) {
        const defaults = blockDefaults(block.id);
        for (const list of block.lists ?? []) {
          expect(
            Array.isArray(defaults[list.key]),
            `${block.id}.${list.key} default is not an array`,
          ).toBe(true);
          const sample = defaults[list.key][0];
          if (sample) {
            for (const field of list.fields) {
              expect(
                Object.prototype.hasOwnProperty.call(sample, field.key),
                `${block.id}.${list.key}[].${field.key} missing on default item`,
              ).toBe(true);
            }
          }
        }
      }
    }
  });

  it("block ids satisfy the Firestore content block id rule", () => {
    for (const page of CONTENT_PAGES) {
      for (const block of page.blocks) {
        expect(block.id, `invalid block id "${block.id}"`).toMatch(
          /^[a-z0-9-]{1,60}$/,
        );
      }
    }
  });

  it("getContentPage resolves known pages and returns null otherwise", () => {
    const first = CONTENT_PAGES[0];
    expect(getContentPage(first.id)?.id).toBe(first.id);
    expect(getContentPage("not-a-real-page")).toBeNull();
  });
});
