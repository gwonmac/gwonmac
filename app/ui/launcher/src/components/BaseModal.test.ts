import { mount } from "@vue/test-utils";
import { afterEach, describe, expect, it } from "vitest";
import BaseModal from "./BaseModal.vue";

afterEach(() => document.body.replaceChildren());

describe("BaseModal", () => {
  it("traps focus, closes with Escape, and restores focus", async () => {
    const trigger = document.createElement("button");
    document.body.append(trigger);
    trigger.focus();
    const wrapper = mount(BaseModal, {
      attachTo: document.body,
      props: { labelledby: "title" },
      slots: { default: '<h2 id="title">Title</h2><button id="first">First</button><button id="last">Last</button>' },
    });
    await new Promise((resolve) => setTimeout(resolve));
    expect(document.activeElement?.id).toBe("first");
    document.querySelector<HTMLElement>("#last")!.focus();
    document.querySelector<HTMLElement>(".modal")!.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true }));
    await wrapper.vm.$nextTick();
    expect(document.activeElement?.id).toBe("first");
    document.querySelector<HTMLElement>(".modal")!.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    await wrapper.vm.$nextTick();
    expect(wrapper.emitted("close")).toHaveLength(1);
    wrapper.unmount();
    expect(document.activeElement).toBe(trigger);
  });

  it("wraps Tab past controls that cannot take focus", async () => {
    // A control under a hidden ancestor (or, in a browser, a disabled fieldset
    // while the Edit account form saves) refuses focus; Tab from the last
    // control that can take it must still come back round.
    const wrapper = mount(BaseModal, {
      attachTo: document.body,
      props: { labelledby: "title" },
      slots: { default: '<h2 id="title">Title</h2><button id="first">First</button><button id="usable">Usable</button><div hidden><button id="later">Later</button></div>' },
    });
    await new Promise((resolve) => setTimeout(resolve));
    document.querySelector<HTMLElement>("#usable")!.focus();
    document.querySelector<HTMLElement>(".modal")!.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true }));
    await wrapper.vm.$nextTick();
    expect(document.activeElement?.id).toBe("first");
    wrapper.unmount();
  });
});
