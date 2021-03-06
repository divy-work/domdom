import test from "ava";
import createHodor from "../src/hodor";
import createStower from "../src/stower";
import domdom, { Hodor, Callback } from "../src";
import createData from "@eirikb/data";

// @ts-ignore
import browserEnv from "browser-env";

browserEnv();

const { React } = domdom();

interface HodorWithMount extends Hodor {
  mount: Function;
}

function setup(path: string, listener?: Callback) {
  const data = createData();
  const element = document.createElement("div");
  const stower = createStower(element);
  const hodor = createHodor(data, path, listener) as HodorWithMount;
  hodor.stower(0, stower);
  const html = () => element.outerHTML;
  hodor.mount = () => {
    hodor["mounted"]();
    return { data, element, stower, html };
  };
  return hodor;
}

test("Hold door", (t) => {
  const { data, html } = setup("yes", (v: any) => v)["mount"]();
  data.set("yes", "sir");
  t.deepEqual("<div>sir</div>", html());
});

test("Hold door2", (t) => {
  const { data, html } = setup("yes", (v: any) => v)["mount"]();
  data.set("yes", "no");
  t.deepEqual("<div>no</div>", html());
});

test("No listener default to showing value", (t) => {
  const { data, html } = setup("yes")["mount"]();
  data.set("yes", "yes");
  t.deepEqual("<div>yes</div>", html());
});

test("No listener default to showing value as json", (t) => {
  const { data, html } = setup("yes")["mount"]();
  data.set("yes", { hello: "world" });
  t.deepEqual('<div>{"hello":"world","path":"yes"}</div>', html());
});

test("Listener with JSX", (t) => {
  const { data, html } = setup("yes", (yes: any) => <h1>{yes}</h1>)["mount"]();
  data.set("yes", { hello: "world" });
  t.deepEqual('<div><h1>{"hello":"world"}</h1></div>', html());
});

test("With named card", (t) => {
  const { data, html } = setup("users.$id")["mount"]();
  data.set("users", {
    a: "mr a",
    b: "mr b",
  });
  t.deepEqual("<div>mr amr b</div>", html());
});

test("With named card add remove", (t) => {
  const { data, html } = setup("users.$id", (u: any) => <p>{u}</p>)["mount"]();
  data.set("users", {
    a: "mr a",
    b: "mr b",
    c: "mr c",
  });
  t.deepEqual("<div><p>mr a</p><p>mr b</p><p>mr c</p></div>", html());
  data.unset("users.b");
  t.deepEqual("<div><p>mr a</p><p>mr c</p></div>", html());
  data.set("users.b", "mr B!");
  t.deepEqual("<div><p>mr a</p><p>mr c</p><p>mr B!</p></div>", html());
  data.unset("users.a");
  t.deepEqual("<div><p>mr c</p><p>mr B!</p></div>", html());
  data.set("users.d", "mr d");
  t.deepEqual("<div><p>mr c</p><p>mr B!</p><p>mr d</p></div>", html());
});

test("Map", (t) => {
  const { data, html } = setup("users")
    .map((u) => u)["mount"]();
  data.set("users", {
    a: "mr a",
    b: "mr b",
  });
  t.deepEqual("<div>mr amr b</div>", html());
});

test("Map jsx", (t) => {
  const { data, html } = setup("users")
    .map((u) => <p>{u}</p>)["mount"]();
  data.set("users", {
    a: "mr a",
    b: "mr b",
  });
  t.deepEqual("<div><p>mr a</p><p>mr b</p></div>", html());
});

test("Map add", (t) => {
  const { data, html } = setup("users.*")
    .map((u) => u)["mount"]();
  data.set("users", {
    a: "mr a",
    b: "mr b",
  });
  t.deepEqual("<div>mr amr b</div>", html());
  data.set("users.c", "mr c");
  t.deepEqual("<div>mr amr bmr c</div>", html());
});

test("Map add default sort", (t) => {
  const { data, html } = setup("users.*")
    .map((u) => u)["mount"]();
  data.set("users", {
    a: "mr a",
    c: "mr c",
  });
  t.deepEqual("<div>mr amr c</div>", html());
  data.set("users.b", "mr b");
  t.deepEqual("<div>mr amr bmr c</div>", html());
});

test("Map filter", (t) => {
  const { data, html } = setup("users")
    .map((u) => u)
    .filter((u) => u !== "mr b")["mount"]();
  data.set("users", {
    a: "mr a",
    b: "mr b",
    c: "mr c",
  });
  t.deepEqual("<div>mr amr c</div>", html());
});

test("Update filterOn on update after data is set", (t) => {
  const { data, html } = setup("users")
    .map((user) => user)
    .filterOn(
      "test",
      (filter, user) => new RegExp(filter, "i").test(user),
    )["mount"]();
  data.set("test", "");
  data.set("users", { a: "a", b: "b" });
  t.is("<div>ab</div>", html());
  data.set("test", "b");
  t.is("<div>b</div>", html());
});

test("on sortOn - custom order", (t) => {
  const { data, html } = setup("players.*")
    .map((player) => <p>{player.name}</p>)
    .sortOn("test", (_, a, b) => b.name.localeCompare(a.name))["mount"]();
  data.set("test", "yes");
  data.set("players.1", { name: "1" });
  data.set("players.2", { name: "2" });
  data.set("players.3", { name: "3" });
  t.is("<div><p>3</p><p>2</p><p>1</p></div>", html());
  data.unset("players.1");
  t.is("<div><p>3</p><p>2</p></div>", html());
  data.set("players.1", { name: "7" });
  t.is("<div><p>7</p><p>3</p><p>2</p></div>", html());
});

test("filterOn and back", (t) => {
  const { data, html } = setup("users")
    .map((user) => <a>{user.name}</a>)
    .filterOn(
      "test",
      (filter, user) => new RegExp(filter, "i").test(user.name),
    )["mount"]();

  data.set("test", "");
  data.set("users", { one: { name: "One!" }, two: { name: "Two!" } });
  t.is("<div><a>One!</a><a>Two!</a></div>", html());

  data.set("test", "two");
  t.is("<div><a>Two!</a></div>", html());

  data.set("test", "");
  t.is("<div><a>One!</a><a>Two!</a></div>", html());
  t.pass();
});

test("on sortOn - custom order update", (t) => {
  const { data, html } = setup("players.*")
    .map((player) => <p>{player.name}</p>)
    .sortOn("test", (_, a, b) => b.name.localeCompare(a.name))["mount"]();

  data.set("players.1", { name: "1" });
  data.set("players.2", { name: "2" });
  data.set("players.3", { name: "3" });
  data.set("test", "yes");
  t.is("<div><p>3</p><p>2</p><p>1</p></div>", html());

  data.unset("players.1");
  t.is("<div><p>3</p><p>2</p></div>", html());

  data.set("players.1", { name: "7" });
  t.is("<div><p>7</p><p>3</p><p>2</p></div>", html());
});

test("onFilter and onSort", (t) => {
  const { data, html } = setup("players.*")
    .map((player) => <p>{player.name}</p>)
    .sortOn(
      "filter.by",
      (val, a, b) => a[val].localeCompare(b[val]),
    )["mount"]();
  data.set("filter.by", "name");
  data.set("players.1", { name: "1", age: "3" });
  data.set("players.2", { name: "2", age: "2" });
  data.set("players.3", { name: "3", age: "1" });
  t.is("<div><p>1</p><p>2</p><p>3</p></div>", html());
  data.set("filter.by", "age");
  t.is("<div><p>3</p><p>2</p><p>1</p></div>", html());
  t.pass();
});

test("Pathifier sub-array", (t) => {
  const { data, html } = setup("players")
    .map((player) => player.name)["mount"]();
  data.set("players", [{ name: "a" }, { name: "b" }]);
  t.is(html(), "<div>ab</div>");
  data.set("players", [{ name: "a", x: [1] }]);
  t.is(html(), "<div>a</div>");
});
