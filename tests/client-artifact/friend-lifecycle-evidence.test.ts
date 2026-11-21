/** Offline mutations prove the friend lifecycle graph without granting runtime authority. */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { inspectFriendLifecycle } from "../../app/client/certification/friend-lifecycle-evidence.js";
import { friendSemanticBodyShape } from "../../app/client/certification/friend-semantic-shape.js";
import { REVIEWED_GENERATIONS } from "../../app/client/certification/reviewed-facts.js";
import {
  deriveFriendObserverCertificate,
  isFriendObserverCertificate,
} from "../../app/client/certification/friend-observer-certificate.js";
import { wasmEvidence } from "../../app/client/certification/wasm-evidence.js";
import {
  concat, encodeCode, encodeSection, paddedIndex, parseCode,
  sectionById, sleb, splitSections, WASM_HEADER,
} from "../../app/main/core/wasm-binary.js";

test("friend lifecycle roles survive movement and refuse changed notification paths", {
  timeout: 120_000,
}, async (t) => {
  const path = process.env.GW_CLIENT_WASM;
  assert.ok(path, "GW_CLIENT_WASM must name a retained official artifact");
  const input = new Uint8Array(await readFile(path));
  const evidence = wasmEvidence(input);
  assert.ok(evidence);
  const module = evidence.moduleView();
  const functions = evidence.decodeFunctions([]);
  const original = inspectFriendLifecycle(input);
  assert.equal(original.status, "candidate");
  assert.equal(original.runtimeAuthority, false);
  const candidate = original.candidate!;
  assert.equal(candidate.eventContextPointer % 4, 0);
  assert.ok(candidate.eventContextPointer + 4 <= evidence.data.initialMemoryBytes);
  const certificate = deriveFriendObserverCertificate(input);
  assert.ok(certificate);
  assert.equal(isFriendObserverCertificate(certificate, original.inputSha256), true);
  const participating = new Set(Object.values(candidate.roles));
  const local = (index: number): number => index - module.functionImportCount;
  const destination = (source: number): number => {
    const found = functions.find((fn) =>
      !participating.has(fn.functionIndex)
      && module.functionTypeIndices[fn.functionIndex] === module.functionTypeIndices[source]
      && !evidence.tableRelations.has(fn.functionIndex)
      && !module.exports.some((entry) => entry.kind === 0 && entry.index === fn.functionIndex)
    );
    assert.ok(found);
    return found.functionIndex;
  };
  const mutate = (edit: (bodies: Uint8Array[]) => void): Uint8Array => {
    const sections = splitSections(input);
    const bodies = parseCode(sectionById(sections, 10));
    edit(bodies);
    const output = concat(WASM_HEADER, ...sections.map((section) => encodeSection(
      section.id === 10 ? { id: 10, body: encodeCode(bodies) } : section,
    )));
    assert.equal(WebAssembly.validate(new Uint8Array(output)), true);
    return output;
  };
  const inspect = (bytes: Uint8Array) => {
    const result = inspectFriendLifecycle(bytes);
    assert.equal(result.runtimeAuthority, false);
    assert.notEqual(result.inputSha256, original.inputSha256);
    return result;
  };

  await t.test("the queue append role can move independently", () => {
    const source = candidate.roles.queueAppend;
    const target = destination(source);
    const moved = mutate((bodies) => {
      for (const fn of functions) {
        for (const [callee, sites] of fn.callSites) {
          if (callee !== source && callee !== target) continue;
          for (const site of sites) {
            bodies[local(fn.functionIndex)]!.set(
              paddedIndex(callee === source ? target : source), site.offset + 1,
            );
          }
        }
      }
      [bodies[local(source)], bodies[local(target)]] = [
        bodies[local(target)]!, bodies[local(source)]!,
      ];
    });
    const result = inspect(moved);
    assert.equal(result.status, "candidate");
    assert.equal(result.candidate?.roles.queueAppend, target);
  });

  await t.test("a queue facade disconnected from the append role is refused", () => {
    const facade = candidate.roles.queueFacade;
    const source = candidate.roles.queueAppend;
    const target = destination(source);
    const changed = mutate((bodies) => {
      const fn = functions.find((entry) => entry.functionIndex === facade)!;
      const site = fn.callSites.get(source)![0]!;
      bodies[local(facade)]!.set(paddedIndex(target), site.offset + 1);
    });
    assert.equal(inspect(changed).status, "unavailable");
  });

  await t.test("changed active-connection store coverage is refused", () => {
    const source = candidate.roles.disconnect;
    const changed = mutate((bodies) => {
      const fn = functions.find((entry) => entry.functionIndex === source)!;
      const site = fn.memorySites.find((memory) => memory.value === candidate.connectionPointer
        && memory.opcode === 0x36)!;
      const body = bodies[local(source)]!;
      body[site.operandStart] = body[site.operandStart]! + 4;
    });
    assert.equal(inspect(changed).status, "unavailable");
  });

  await t.test("a changed user-event roster callback binding is refused", () => {
    const source = candidate.roles.rosterRegistration;
    const changed = mutate((bodies) => {
      const fn = functions.find((entry) => entry.functionIndex === source)!;
      const site = fn.constantSites.find((constant) =>
        constant.value === candidate.rosterCallbackTableSlot
      )!;
      const body = bodies[local(source)]!;
      body[site.operandStart] = body[site.operandStart]! + 1;
    });
    assert.equal(inspect(changed).status, "unavailable");
  });

  await t.test("a duplicate lifecycle role is refused", () => {
    const source = candidate.roles.logout;
    const duplicated = mutate((bodies) => {
      bodies[local(destination(source))] = bodies[local(source)]!.slice();
    });
    assert.equal(inspect(duplicated).status, "unavailable");
  });

  // An assertion line: the constant between a source-file string and a call.
  const assertionLine = (role: keyof typeof candidate.roles) => {
    const fn = functions.find((entry) => entry.functionIndex === candidate.roles[role])!;
    const calls = new Set([...fn.callSites.values()].flatMap((sites) => sites.map((site) => site.offset)));
    const constants = [...fn.constantSites].sort((left, right) => left.offset - right.offset);
    const line = constants.find((site, index) => {
      const file = constants[index - 1];
      const text = file && evidence.data.contains(file.value) ? evidence.data.readCString(file.value) : null;
      return file !== undefined && site.offset === file.operandEnd && calls.has(site.operandEnd)
        && text !== null && /\.(?:cpp|h)$/u.test(text);
    });
    assert.ok(line, `${role} asserts with a source line`);
    return line;
  };
  /** The body of `role` with its assertion line encoded as `value`. */
  const withLine = (role: keyof typeof candidate.roles, value: (line: number) => number) => {
    const line = assertionLine(role);
    const body = module.bodies[local(candidate.roles[role])]!;
    return concat(body.subarray(0, line.operandStart), sleb(value(line.value)), body.subarray(line.operandEnd));
  };
  const sameWidth = (line: number) => (line & 0x3f) === 0x3f ? line - 1 : line + 1;
  const lineFreeFamily = REVIEWED_GENERATIONS
    .flatMap((generation) => generation.facts?.friendLifecycleRoles ?? [])
    .some((family) => Object.entries(candidate.roles).every(([role, index]) =>
      family.sourceLinesErased?.[role as keyof typeof candidate.roles] === friendSemanticBodyShape(
        module, evidence.data, functions.find((fn) => fn.functionIndex === index)!, "erased")));

  await t.test("a role whose assertion line moved still matches its reviewed family", {
    skip: lineFreeFamily ? false : "no reviewed family of this client carries line-free shapes",
  }, () => {
    const moved = mutate((bodies) => {
      bodies[local(candidate.roles.logout)] = withLine("logout", sameWidth);
      bodies[local(candidate.roles.connectionEvent)] = withLine("connectionEvent", sameWidth);
    });
    const result = inspect(moved);
    assert.equal(result.status, "candidate");
    assert.deepEqual(result.candidate?.roles, candidate.roles);
  });

  await t.test("a moved assertion line on a duplicated role is refused", () => {
    const duplicated = mutate((bodies) => {
      const moved = withLine("logout", sameWidth);
      bodies[local(candidate.roles.logout)] = moved;
      bodies[local(destination(candidate.roles.logout))] = moved.slice();
    });
    assert.equal(inspect(duplicated).status, "unavailable");
  });

  await t.test("an assertion line that changes its encoded width is refused", () => {
    const widened = mutate((bodies) => {
      bodies[local(candidate.roles.logout)] = withLine("logout", (line) => line < 64 ? 64 : line * 128);
    });
    assert.equal(inspect(widened).status, "unavailable");
  });

  await t.test("a changed constant that no relation checks is refused", () => {
    const source = candidate.roles.logout;
    const line = assertionLine("logout");
    const changed = mutate((bodies) => {
      const fn = functions.find((entry) => entry.functionIndex === source)!;
      const site = fn.constantSites.find((constant) => constant.offset !== line.offset
        && !evidence.data.contains(constant.value)
        && !(constant.value >= evidence.data.zeroInitializedBase
          && constant.value < evidence.data.initialMemoryBytes)
        && (constant.value & 0x3f) !== 0x3f && constant.operandEnd - constant.operandStart === 1)!;
      assert.ok(site, "logout has a one-byte constant");
      const body = bodies[local(source)]!;
      body[site.operandStart] = body[site.operandStart]! + 1;
    });
    assert.equal(inspect(changed).status, "unavailable");
  });

  await t.test("the IPC certificate refuses altered semantic and hook facts", () => {
    for (const record of [
      { ...certificate.record, recordLayout: null },
      { ...certificate.record, scalarWriters: [null, null] },
    ]) {
      assert.equal(isFriendObserverCertificate({ ...certificate, record }, original.inputSha256), false);
    }
    assert.equal(isFriendObserverCertificate({
      ...certificate,
      semanticSha256: "0".repeat(64),
    }, original.inputSha256), false);
    assert.equal(isFriendObserverCertificate({
      ...certificate,
      lifecycle: { ...certificate.lifecycle, connectionPointer: -1 },
    }, original.inputSha256), false);
    assert.equal(isFriendObserverCertificate({
      ...certificate,
      lifecycle: { ...certificate.lifecycle, rosterCallbackTableSlot: -1 },
    }, original.inputSha256), false);
    assert.equal(isFriendObserverCertificate({
      ...certificate,
      lifecycle: {
        ...certificate.lifecycle,
        connectionStoreOffsets: {
          ...certificate.lifecycle.connectionStoreOffsets,
          connectionEvent: certificate.lifecycle.connectionStoreOffsets.connectionEvent.slice(1),
        },
      },
    }, original.inputSha256), false);
  });
});
