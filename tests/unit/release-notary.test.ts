import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  notarizeAndStaple,
  validateTicket,
  type NotaryDependencies,
} from "../../scripts/release-notary.ts";
import type { CommandResult } from "../../scripts/release.ts";

const CREDENTIALS = { key: "/k.p8", keyId: "KEY", issuer: "ISSUER" };
const OK: CommandResult = { status: 0, stdout: "The validate action worked!", stderr: "" };
const LOST: CommandResult = {
  status: 65,
  stdout: "",
  stderr: 'CloudKit query failed due to "The network connection was lost." Error Domain=NSURLErrorDomain Code=-1005',
};
const NO_TICKET: CommandResult = { status: 65, stdout: "", stderr: "does not have a ticket stapled to it." };

function apple(answers: Record<string, CommandResult[]>) {
  const calls: string[][] = [];
  const sleeps: number[] = [];
  const dependencies: NotaryDependencies = {
    run(command, args) {
      calls.push([command, ...args]);
      const key = command === "xcrun" ? `${args[0]} ${args[1]}` : command;
      return answers[key]?.shift() ?? OK;
    },
    sleep: (milliseconds) => sleeps.push(milliseconds),
  };
  return { calls, sleeps, dependencies };
}

describe("Apple notary helper", () => {
  it("retries only a lost connection to the ticket service, five tries 30 s apart", () => {
    for (const [answers, status, tries] of [
      [[LOST, LOST, OK], 0, 3],
      [[NO_TICKET], 65, 1],
      [[LOST, LOST, LOST, LOST, LOST, OK], 65, 5],
    ] as const) {
      const fake = apple({ "stapler validate": [...answers] });
      assert.equal(validateTicket("/x.dmg", fake.dependencies).status, status);
      assert.equal(fake.calls.length, tries);
      assert.deepEqual(fake.sleeps, Array(tries - 1).fill(30_000));
    }
  });

  it("submits an app as an archive and staples it through the same retry", () => {
    const fake = apple({
      "notarytool submit": [{ status: 0, stdout: '{"id":"1","status":"Accepted"}', stderr: "" }],
      "stapler staple": [LOST, OK],
    });
    notarizeAndStaple("/out/Guild Wars Reforged.app", CREDENTIALS, fake.dependencies);
    const submit = fake.calls.find((call) => call[1] === "notarytool");
    assert.match(submit?.[3] ?? "", /\/app\.zip$/u);
    assert.deepEqual(fake.calls.filter((call) => call[1] === "stapler").length, 2);
  });

  it("refuses an image Apple did not accept and reports its log", () => {
    const fake = apple({
      "notarytool submit": [{ status: 0, stdout: '{"id":"7","status":"Invalid"}', stderr: "" }],
      "notarytool log": [{ status: 0, stdout: "The binary is not signed.", stderr: "" }],
    });
    assert.throws(
      () => notarizeAndStaple("/out/app.dmg", CREDENTIALS, fake.dependencies),
      /did not accept \/out\/app\.dmg[\s\S]*The binary is not signed\./u,
    );
    assert.equal(fake.calls.some((call) => call[1] === "stapler"), false);
  });
});
