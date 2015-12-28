import { VM } from '../vm';

import {
  BlockScanner
} from '../scanner';

import Syntax, {
  ATTRIBUTE as ATTRIBUTE_SYNTAX,
  CompileInto,
  Attribute as AttributeSyntax,
  Expression as ExpressionSyntax,
  Statement as StatementSyntax,
  PrettyPrintValue,
  PrettyPrint
} from '../syntax';

import {
  InlineBlock as CompiledInlineBlock
} from '../compiled/blocks';

import {
  Opcode
} from '../opcodes';

import {
  PutValue
} from '../compiled/opcodes/vm';

import {
  OpenComponentOpcode,
  CloseComponentOpcode
} from '../compiled/opcodes/component';

import buildExpression from './expressions';

import {
  CompiledArgs,
  CompiledNamedArgs,
  CompiledPositionalArgs,
  EvaluatedArgs
} from '../compiled/expressions/args';

import CompiledValue from '../compiled/expressions/value';

import {
  CompiledLocalRef,
  CompiledSelfRef
} from '../compiled/expressions/ref';

import CompiledHelper from '../compiled/expressions/helper';

import CompiledConcat from '../compiled/expressions/concat';

import {
  CompiledExpression
} from '../compiled/expressions';

import {
  PushPullReference,
  PathReference
} from 'glimmer-reference';

import { Environment, Insertion, Helper as EnvHelper } from '../environment';

import {
  LinkedList,
  InternedString,
  Slice,
  Dict,
  dict,
  intern,
} from 'glimmer-util';

import {
  TextOpcode,
  OpenPrimitiveElementOpcode,
  CloseElementOpcode,
  StaticAttrOpcode,
  DynamicAttrOpcode,
  DynamicPropOpcode,
  AddClassOpcode,
  CommentOpcode
} from '../compiled/opcodes/dom';

import {
  AppendOpcode,
  TrustingAppendOpcode
} from '../compiled/opcodes/content';

import {
  Statements as SerializedStatements,
  Expressions as SerializedExpressions,
  Core as SerializedCore
} from 'glimmer-compiler';

interface Bounds {
  parentNode(): Node;
  firstNode(): Node;
  lastNode(): Node;
}

interface Reference {}

const EMPTY_ARRAY = Object.freeze([]);

export interface BlockOptions {

}

export class Block extends StatementSyntax {
  public type = "block";

  static fromSpec(sexp: SerializedStatements.Block, children: CompiledInlineBlock[]): Block {
    let [, path, params, hash, templateId, inverseId] = sexp;

    return new Block({
      path: path as InternedString[],
      args: Args.fromSpec(params as InternedString[], hash),
      templates: Templates.fromSpec([templateId, inverseId], children)
    });
  }

  static build(options): Block {
    return new this(options);
  }

  path: InternedString[];
  args: Args;
  templates: Templates;

  constructor(options: { path: InternedString[], args: Args, templates: Templates }) {
    super();
    this.path = options.path;
    this.args = options.args;
    this.templates = options.templates;
  }

  scan(scanner: BlockScanner): StatementSyntax {
    let { default: _default, inverse } = this.templates;

    if (_default) scanner.addChild(_default);
    if (inverse)  scanner.addChild(inverse);

    return this;
  }

  compile(ops: CompileInto) {
    throw new Error("SyntaxError");
  }

  prettyPrint() {
    return null;

    // let [params, hash] = this.args.prettyPrint();
    // let block = new PrettyPrint('expr', this.path.join('.'), params, hash);
    // return new PrettyPrint('block', 'block', [block], null, this.templates.prettyPrint());
  }
}

export class Unknown extends ExpressionSyntax {
  public type = "unknown";

  static fromSpec(sexp: SerializedExpressions.Unknown): Unknown {
    let [, path] = sexp;

    return new Unknown({ ref: new Ref({ parts: path as InternedString[] }) });
  }

  static build(path: string, unsafe: boolean): Unknown {
    return new this({ ref: Ref.build(path), unsafe });
  }

  ref: Ref;
  trustingMorph: boolean;

  constructor(options) {
    super();
    this.ref = options.ref;
    this.trustingMorph = !!options.unsafe;
  }

  compile(compiler: CompileInto, env: Environment): CompiledExpression {
    let { ref } = this;

    if (env.hasHelper(ref.parts)) {
      return new CompiledHelper({ helper: env.lookupHelper(ref.parts), args: CompiledArgs.empty() });
    } else {
      return this.ref.compile(compiler);
    }
  }

  simplePath(): InternedString {
    return this.ref.simplePath();
  }
}

export class Append extends StatementSyntax {
  public type = "append";

  static fromSpec(sexp: SerializedStatements.Append): Append {
    let [, value, trustingMorph] = sexp;

    return new Append({ value: buildExpression(value), trustingMorph });
  }

  static build(value: ExpressionSyntax, trustingMorph: boolean) {
    return new this({ value, trustingMorph });
  }

  value: ExpressionSyntax;
  trustingMorph: boolean;

  constructor({ value, trustingMorph }: { value: ExpressionSyntax, trustingMorph: boolean }) {
    super();
    this.value = value;
    this.trustingMorph = trustingMorph;
  }

  prettyPrint(): PrettyPrint {
    let operation = this.trustingMorph ? 'html' : 'text';
    return new PrettyPrint('append', operation, [this.value.prettyPrint()]);
  }

  compile(compiler: CompileInto, env: Environment) {
    compiler.append(new PutValue({ expression: this.value.compile(compiler, env) }));

    if (this.trustingMorph) {
      compiler.append(new TrustingAppendOpcode());
    } else {
      compiler.append(new AppendOpcode());
    }
  }
}

class HelperInvocationReference extends PushPullReference implements PathReference {
  private helper: EnvHelper;
  private args: EvaluatedArgs;

  constructor(helper: EnvHelper, args: EvaluatedArgs) {
    super();
    this.helper = helper;
    this.args = args;
  }

  get(): PathReference {
    throw new Error("Unimplemented: Yielding the result of a helper call.");
  }

  value(): Insertion {
    let { args: { positional, named } }  = this;
    return this.helper.call(undefined, positional.value(), named.value(), null);
  }
}

/*
export class Modifier implements StatementSyntax {
  static fromSpec(node) {
    let [, path, params, hash] = node;

    return new Modifier({
      path,
      params: Params.fromSpec(params),
      hash: Hash.fromSpec(hash)
    });
  }

  static build(path, options) {
    return new Modifier({
      path,
      params: options.params,
      hash: options.hash
    });
  }

  constructor(options) {
    this.path = options.path;
    this.params = options.params;
    this.hash = options.hash;
  }

  evaluate(stack) {
    return stack.createMorph(Modifier);
  }
}
*/

export class DynamicProp extends AttributeSyntax {
  "e1185d30-7cac-4b12-b26a-35327d905d92" = true;
  type = "dynamic-prop";

  static fromSpec(sexp: SerializedStatements.DynamicProp): DynamicProp {
    let [, name, value] = sexp;

    return new DynamicProp({
      name: name as InternedString,
      value: buildExpression(value)
    });
  }

  static build(name: string, value: any): DynamicProp {
    return new this({ name: intern(name), value });
  }

  public name: InternedString;
  public value: ExpressionSyntax;

  constructor(options: { name: InternedString, value: ExpressionSyntax }) {
    super();
    this.name = options.name;
    this.value = options.value;
  }

  prettyPrint() {
    let { name, value } = this;

    return new PrettyPrint('attr', 'prop', [name, value.prettyPrint()]);
  }

  compile(compiler: CompileInto, env: Environment) {
    compiler.append(new PutValue({ expression: this.value.compile(compiler, env) }));
    compiler.append(new DynamicPropOpcode(this));
  }

  valueSyntax(): ExpressionSyntax {
    return this.value;
  }

  toLookup(): { syntax: DynamicProp, symbol: InternedString } {
    let symbol = this.lookupName();
    let lookup = GetNamedParameter.build(symbol);

    return { syntax: DynamicProp.build(this.name, lookup), symbol };
  }

  isAttribute(): boolean {
    return false;
  }
}

export class StaticAttr extends AttributeSyntax {
  "e1185d30-7cac-4b12-b26a-35327d905d92" = true;
  type = "static-attr";

  static fromSpec(node: SerializedStatements.StaticAttr): StaticAttr {
    let [, name, value, namespace] = node;

    return new StaticAttr({ name, value, namespace });
  }

  static build(name: string, value: string, namespace: string=null): StaticAttr {
    return new this({ name: intern(name), value: intern(value), namespace: namespace && intern(namespace) });
  }

  name: InternedString;
  value: InternedString;
  namespace: InternedString;

  constructor(options) {
    super();
    this.name = options.name;
    this.value = options.value;
    this.namespace = options.namespace;
  }

  prettyPrint() {
    let { name, value, namespace } = this;

    if (namespace) {
      return new PrettyPrint('attr', 'attr', [name, value], { namespace });
    } else {
      return new PrettyPrint('attr', 'attr', [name, value]);
    }
  }

  compile(compiler: CompileInto) {
    compiler.append(new StaticAttrOpcode(this));
  }

  valueSyntax(): ExpressionSyntax {
    return Value.build(this.value);
  }

  toLookup(): { syntax: DynamicAttr, symbol: InternedString } {
    let symbol = this.lookupName();
    let lookup = GetNamedParameter.build(symbol);

    return { syntax: DynamicAttr.build(this.name, lookup, this.namespace), symbol };
  }

  isAttribute(): boolean {
    return true;
  }
}

export class DynamicAttr extends AttributeSyntax {
  "e1185d30-7cac-4b12-b26a-35327d905d92" = true;
  type = "dynamic-attr";

  static fromSpec(sexp: SerializedStatements.DynamicAttr): DynamicAttr {
    let [, name, value, namespace] = sexp;

    return new DynamicAttr({
      name: name as InternedString,
      namespace: namespace as InternedString,
      value: buildExpression(value)
    });
  }

  static build(_name: string, value: ExpressionSyntax, _namespace: string=null): DynamicAttr {
    let name = intern(_name);
    let namespace = _namespace ? intern(_namespace) : null;
    return new this({ name, value, namespace });
  }

  name: InternedString;
  value: ExpressionSyntax;
  namespace: InternedString;

  constructor(options: { name: InternedString, value: ExpressionSyntax, namespace: InternedString }) {
    super();
    this.name = options.name;
    this.value = options.value;
    this.namespace = options.namespace;
  }

  prettyPrint() {
    let { name, value, namespace } = this;

    if (namespace) {
      return new PrettyPrint('attr', 'attr', [name, value.prettyPrint()], { namespace });
    } else {
      return new PrettyPrint('attr', 'attr', [name, value.prettyPrint()]);
    }
  }

  compile(compiler: CompileInto, env: Environment) {
    compiler.append(new PutValue({ expression: this.value.compile(compiler, env) }));
    compiler.append(new DynamicAttrOpcode(this));
  }

  valueSyntax(): ExpressionSyntax {
    return this.value;
  }

  toLookup(): { syntax: DynamicAttr, symbol: InternedString } {
    let symbol = this.lookupName();
    let lookup = GetNamedParameter.build(symbol);

    return { syntax: DynamicAttr.build(this.name, lookup, this.namespace), symbol };
  }

  isAttribute(): boolean {
    return true;
  }
}

export class AddClass extends AttributeSyntax {
  "e1185d30-7cac-4b12-b26a-35327d905d92" = true;
  type = "add-class";

  static fromSpec(node: SerializedStatements.AddClass): AddClass {
    let [, value] = node;

    return new AddClass({ value: buildExpression(value) });
  }

  static build(value: ExpressionSyntax): AddClass {
    return new this({ value });
  }

  public name = <InternedString>"class";
  public value: ExpressionSyntax;

  constructor({ value }: { value: ExpressionSyntax }) {
    super();
    this.value = value;
  }

  prettyPrint(): PrettyPrint {
    return new PrettyPrint('attr', 'attr', ['class', this.value.prettyPrint()]);
  }

  compile(compiler: CompileInto, env: Environment) {
    compiler.append(new PutValue({ expression: this.value.compile(compiler, env) }));
    compiler.append(new AddClassOpcode());
  }

  valueSyntax(): ExpressionSyntax {
    return this.value;
  }

  toLookup(): { syntax: AddClass, symbol: InternedString } {
    let symbol = this.lookupName();
    let lookup = GetNamedParameter.build(name);

    return { syntax: AddClass.build(lookup), symbol };
  }

  isAttribute() {
    return true;
  }
}

export class CloseElement extends StatementSyntax {
  type = "close-element";

  static fromSpec() {
    return new CloseElement();
  }

  static build() {
    return new this();
  }

  prettyPrint() {
    return new PrettyPrint('element', 'close-element');
  }

  compile(compiler: CompileInto) {
    compiler.append(new CloseElementOpcode());
  }
}

export class Text extends StatementSyntax {
  type = "text";

  static fromSpec(node: SerializedStatements.Text): Text {
    let [, content] = node;

    return new Text({ content: content as InternedString });
  }

  static build(content): Text {
    return new this({ content });
  }

  public content: InternedString;

  constructor(options: { content: InternedString }) {
    super();
    this.content = options.content;
  }

  prettyPrint() {
    return new PrettyPrint('append', 'text', [this.content]);
  }

  compile(compiler: CompileInto) {
    compiler.append(new TextOpcode({ text: this.content }));
  }
}

export class Comment extends StatementSyntax {
  type = "comment";

  static fromSpec(sexp: SerializedStatements.Comment): Comment {
    let [, value] = sexp;

    return new Comment({ value });
  }

  static build(value: string): Comment {
    return new this({ value: intern(value) });
  }

  public comment: InternedString;

  constructor(options) {
    super();
    this.comment = options.value;
  }

  prettyPrint() {
    return new PrettyPrint('append', 'append-comment', [this.comment]);
  }

  compile(compiler: CompileInto) {
    compiler.append(new CommentOpcode(this));
  }
}

export class OpenElement extends StatementSyntax {
  type = "open-element";

  static fromSpec(sexp: SerializedStatements.OpenElement): OpenElement {
    let [, tag, blockParams] = sexp;

    return new OpenElement({
      tag: tag as InternedString,
      blockParams: blockParams as InternedString[]
    });
  }

  static build(tag: string, blockParams: string[]): OpenElement {
    return new this({ tag: intern(tag), blockParams: blockParams && blockParams.map(intern) });
  }

  public tag: InternedString;
  public blockParams: InternedString[];

  constructor(options: { tag: InternedString, blockParams: InternedString[] }) {
    super();
    this.tag = options.tag;
    this.blockParams = options.blockParams;
  }

  scan(scanner: BlockScanner): StatementSyntax {
    let { tag } = this;

    if (scanner.env.hasComponentDefinition([tag], this)) {
      let attrs = this.attributes(scanner);
      let contents = this.tagContents(scanner);
      return new Component({ tag, attrs, contents });
    } else {
      return new OpenPrimitiveElement({ tag });
    }
  }

  prettyPrint() {
    let params = new PrettyPrint('block-params', 'as', this.blockParams);
    return new PrettyPrint('element', 'open-element', [this.tag, params]);
  }

  compile(list: CompileInto, env: Environment) {
    list.append(new OpenPrimitiveElementOpcode(this));
  }

  toIdentity(): OpenPrimitiveElement {
    let { tag } = this;
    return new OpenPrimitiveElement({ tag });
  }

  private attributes(scanner: BlockScanner): Slice<AttributeSyntax> {
    let current = scanner.next();
    let attrs = new LinkedList<AttributeSyntax>();

    while (current[ATTRIBUTE_SYNTAX]) {
      let attr = <AttributeSyntax>current;
      attrs.append(attr);
      current = scanner.next();
    }

    scanner.unput(current);

    return attrs;
  }

  private tagContents(scanner: BlockScanner): Slice<StatementSyntax> {
    let nesting = 1;
    let list = new LinkedList<StatementSyntax>();

    while (true) {
      let current = scanner.next();
      if (current instanceof CloseElement && --nesting === 0) {
        break;
      }

      list.append(current);

      if (current instanceof OpenElement || current instanceof OpenPrimitiveElement) {
        nesting++;
      }
    }

    return list;
  }
}

export class Component extends StatementSyntax {
  public type = 'component';
  public tag: InternedString;
  public attrs: Slice<AttributeSyntax>;
  public contents: Slice<StatementSyntax>;

  constructor({ tag, attrs, contents }: { tag: InternedString, attrs: Slice<AttributeSyntax>, contents: Slice<StatementSyntax> }) {
    super();
    this.tag = tag;
    this.attrs = attrs;
    this.contents = contents;
  }

  compile(list: CompileInto, env: Environment) {
    let definition = env.getComponentDefinition([this.tag], this);
    let args = Args.fromHash(attributesToNamedArgs(this.attrs)).compile(list, env);
    let shadow = shadowList(this.attrs);
    let block = new CompiledInlineBlock({ children: null, ops: null, locals: [], program: this.contents });
    let templates = new Templates({ template: block, inverse: null });

    list.append(new OpenComponentOpcode({ definition, args, shadow, templates }));
    list.append(new CloseComponentOpcode());
  }
}

function shadowList(attrs: Slice<AttributeSyntax>) {
  let list: InternedString[] = [];

  attrs.forEachNode(node => {
    if (node.isAttribute()) list.push(node.name);
  });

  return list;
}

function attributesToNamedArgs(attrs: Slice<AttributeSyntax>): NamedArgs {
  let map = dict<ExpressionSyntax>();

  attrs.forEachNode(a => {
    map[`@${a.name}`] = a.valueSyntax();
  });

  return NamedArgs.build(map);
}

export class OpenPrimitiveElement extends StatementSyntax {
  type = "open-primitive-element";

  public tag: InternedString;

  static build(tag: string): OpenPrimitiveElement {
    return new this({ tag: intern(tag) });
  }

  constructor(options: { tag: InternedString }) {
    super();
    this.tag = options.tag;
  }

  prettyPrint() {
    return new PrettyPrint('element', 'open-element', [this.tag]);
  }

  compile(compiler: CompileInto) {
    compiler.append(new OpenPrimitiveElementOpcode({ tag: this.tag }));
  }
}

export class Yield extends StatementSyntax {
  static fromSpec(sexp: SerializedStatements.Yield): Yield {
    let [, to, params] = sexp;

    let args = Args.fromSpec(params, null);

    return new Yield({ to: to as InternedString, args });
  }

  static build(params: ExpressionSyntax[], to: string): Yield {
    let args = Args.fromPositionalArgs(PositionalArgs.build(params));
    return new this({ to: intern(to), args });
  }

  type = "yield";
  public to: InternedString;
  public args: Args;

  constructor({ to, args }: { to: InternedString, args: Args }) {
    super();
    this.to = to;
    this.args = args;
  }

  compile(compiler: CompileInto) {
    let to = compiler.getBlockSymbol(this.to);
    compiler.append(new InvokeBlockOpcode({ to }));
  }
}

class InvokeBlockOpcode extends Opcode {
  type = "invoke-block";
  public to: number;

  constructor({ to }: { to: number }) {
    super();
    this.to = to;
  }

  evaluate(vm: VM) {
    vm.invokeTemplate(this.to);
  }
}

export class Value extends ExpressionSyntax {
  type = "value";

  static fromSpec(value: SerializedExpressions.Value): Value {
    return new Value(value);
  }

  static build(value) {
    return new this(value);
  }

  public value: boolean | string | number;

  constructor(value) {
    super();
    this.value = value;
  }

  prettyPrint() {
    return String(this.value);
  }

  inner() {
    return this.value;
  }

  compile(compiler: CompileInto): CompiledExpression {
    return new CompiledValue(this);
  }
}

export class Get extends ExpressionSyntax {
  type = "get";

  static fromSpec(sexp: SerializedExpressions.Get): Get {
    let [, parts] = sexp;

    return new Get({ ref: new Ref({ parts: parts as InternedString[] }) });
  }

  static build(path: string): Get {
    return new this({ ref: Ref.build(path) });
  }

  public ref: Ref;

  constructor(options) {
    super();
    this.ref = options.ref;
  }

  prettyPrint() {
    return new PrettyPrint('expr', 'get', [this.ref.prettyPrint()], null);
  }

  compile(compiler: CompileInto): CompiledExpression {
    return this.ref.compile(compiler);
  }
}

export class GetNamedParameter extends ExpressionSyntax {
  type = "get";

  static fromSpec(sexp: SerializedExpressions.Attr): GetNamedParameter {
    let [, parts] = sexp;

    return new GetNamedParameter({ parts: parts as InternedString[] });
  }

  static build(path: string): GetNamedParameter {
    return new this({ parts: path.split('.').map(intern) });
  }

  public parts: InternedString[];

  constructor(options: { parts: InternedString[] }) {
    super();
    this.parts = options.parts;
  }

  prettyPrint() {
    return new PrettyPrint('expr', 'get-named', [this.parts.join('.')], null);
  }

  compile(compiler: CompileInto): CompiledExpression {
    let { parts } = this;
    let front = parts[0];
    let symbol = compiler.getSymbol(front);

    let lookup = parts.slice(1);
    return new CompiledLocalRef({ symbol, lookup });
  }
}

// intern paths because they will be used as keys
function internPath(path: string): InternedString[] {
  return path.split('.').map(intern);
}

// this is separated out from Get because Unknown also has a ref, but it
// may turn out to be a helper
class Ref extends ExpressionSyntax {
  type = "ref";

  static build(path: string): Ref {
    return new this({ parts: internPath(path) });
  }

  public parts: InternedString[];

  constructor({ parts }: { parts: InternedString[] }) {
    super();
    this.parts = parts;
  }

  prettyPrint() {
    return this.parts.join('.');
  }

  compile(compiler: CompileInto): CompiledExpression {
    let { parts } = this;
    let front = parts[0];
    let symbol = compiler.getSymbol(front);

    if (symbol) {
      let lookup = parts.slice(1);
      return new CompiledLocalRef({ symbol, lookup });
    } else {
      return new CompiledSelfRef({ parts });
    }
  }

  path(): InternedString[] {
    return this.parts;
  }

  simplePath(): InternedString {
    if (this.parts.length === 1) {
      return this.parts[0];
    }
  }
}

export class Helper extends ExpressionSyntax {
  type = "helper";

  static fromSpec(sexp: SerializedExpressions.Helper): Helper {
    let [, path, params, hash] = sexp;

    return new Helper({
      ref: new Ref({ parts: path as InternedString[] }),
      args: Args.fromSpec(params, hash)
    });
  }

  static build(path: string, positional: PositionalArgs, named: NamedArgs): Helper {
    return new this({ ref: Ref.build(path), args: new Args({ positional, named }) });
  }

  isStatic = false;
  ref: Ref;
  args: Args;

  constructor(options: { ref: Ref, args: Args }) {
    super();
    this.ref = options.ref;
    this.args = options.args;
  }

  prettyPrint() {
    let [params, hash] = this.args.prettyPrint();
    return new PrettyPrint('expr', this.ref.prettyPrint(), params, hash);
  }

  compile(compiler: CompileInto, env: Environment): CompiledExpression {
    if (env.hasHelper(this.ref.parts)) {
      let { args, ref } = this;
      return new CompiledHelper({ helper: env.lookupHelper(ref.parts), args: args.compile(compiler, env) });
    } else {
      throw new Error(`Compile Error: ${this.ref.prettyPrint()} is not a helper`);
    }
  }

  simplePath(): InternedString {
    return this.ref.simplePath();
  }
}

export class Concat extends Syntax {
  type = "concat";

  static fromSpec(sexp: SerializedExpressions.Concat): Concat {
    let [, params] = sexp;

    return new Concat({ parts: params.map(buildExpression) });
  }

  static build(parts): Concat {
    return new this({ parts });
  }

  isStatic = false;
  parts: ExpressionSyntax[];

  constructor({ parts }: { parts: ExpressionSyntax[] }) {
    super();
    this.parts = parts;
  }

  prettyPrint() {
    return new PrettyPrint('expr', 'concat', this.parts.map(p => p.prettyPrint()));
  }

  compile(compiler: CompileInto, env: Environment): CompiledConcat {
    return new CompiledConcat({ parts: this.parts.map(p => p.compile(compiler, env)) });
  }
}

export class Args extends Syntax {
  public type = "args";

  static fromSpec(positional: SerializedCore.Params, named: SerializedCore.Hash): Args {
    return new Args({ positional: PositionalArgs.fromSpec(positional), named: NamedArgs.fromSpec(named) });
  }

  static _empty: Args;

  static empty(): Args {
    return (this._empty = this._empty || new Args({ positional: PositionalArgs.empty(), named: NamedArgs.empty() }));
  }

  static fromPositionalArgs(positional: PositionalArgs): Args {
    return new Args({ positional, named: NamedArgs.empty() });
  }

  static fromHash(named: NamedArgs): Args {
    return new Args({ positional: PositionalArgs.empty(), named });
  }

  static build(positional: PositionalArgs, named: NamedArgs): Args {
    return new this({ positional, named });
  }

  public positional: PositionalArgs;
  public named: NamedArgs;
  public isStatic = false;

  constructor(options: { positional: PositionalArgs, named: NamedArgs }) {
    super();
    this.positional = options.positional;
    this.named = options.named;
  }

  prettyPrint() {
    // return [this.positional.prettyPrint(), this.named.prettyPrint()];
    return null;
  }

  compile(compiler: CompileInto, env: Environment): CompiledArgs {
    let { positional, named } = this;
    return CompiledArgs.create({ positional: positional.compile(compiler, env), named: named.compile(compiler, env) });
  }
}

export class PositionalArgs extends Syntax {
  public type = "positional";

  static fromSpec(sexp: SerializedCore.Params): PositionalArgs {
    if (!sexp || sexp.length === 0) return PositionalArgs.empty();
    return new PositionalArgs(sexp.map(buildExpression));
  }

  static build(exprs: ExpressionSyntax[]): PositionalArgs {
    return new this(exprs);
  }

  static _empty: PositionalArgs;

  static empty(): PositionalArgs {
    return (this._empty = this._empty || new PositionalArgs([]));
  }

  values: ExpressionSyntax[];
  length: number;
  isStatic = false;

  constructor(exprs: ExpressionSyntax[]) {
    super();
    this.values = exprs;
    this.length = exprs.length;
  }

  push(expr: ExpressionSyntax) {
    this.values.push(expr);
    this.length = this.values.length;
  }

  at(index: number): ExpressionSyntax {
    return this.values[index];
  }

  compile(compiler: CompileInto, env: Environment): CompiledPositionalArgs {
    return CompiledPositionalArgs.create({ values: this.values.map(v => v.compile(compiler, env)) });
  }

  prettyPrint(): PrettyPrintValue {
    return <any>this.values.map(p => p.prettyPrint());
  }
}

export class NamedArgs extends Syntax {
  public type = "named";

  static fromSpec(sexp: SerializedCore.Hash): NamedArgs {
    if (sexp === null || sexp === undefined) { return NamedArgs.empty(); }
    let keys: InternedString[] = [];
    let values = [];
    let map = dict<ExpressionSyntax>();

    Object.keys(sexp).forEach(key => {
      keys.push(key as InternedString);
      let value = map[key] = buildExpression(sexp[key]);
      values.push(value);
    });

    return new this({ keys, values, map });
  }

  static build(map: Dict<ExpressionSyntax>): NamedArgs {
    let keys = [];
    let values = [];

    Object.keys(map).forEach(k => {
      let value = map[k];
      keys.push(k as InternedString);
      values.push(value);
    });

    return new NamedArgs({ keys, values, map });
  }

  static _empty;

  static empty(): NamedArgs {
    return (this._empty = this._empty || new NamedArgs({ keys: EMPTY_ARRAY, values: EMPTY_ARRAY, map: dict<ExpressionSyntax>() }));
  }

  public map: Dict<ExpressionSyntax>;
  public keys: InternedString[];
  public values: ExpressionSyntax[];
  public isStatic = false;

  constructor({ map, keys, values }: { keys: InternedString[], values: ExpressionSyntax[], map: Dict<ExpressionSyntax> }) {
    super();

    this.keys = keys as InternedString[];
    this.values = values;
    this.map = map;
  }

  prettyPrint() {
    let out = dict<PrettyPrintValue>();
    this.keys.forEach((key, i) => {
      out[<string>key] = this.values[i].prettyPrint();
    });
    return JSON.stringify(out);
  }

  add(key: InternedString, value: ExpressionSyntax) {
    this.keys.push(key);
    this.values.push(value);
    this.map[<string>key] = value;
  }

  at(key: InternedString): ExpressionSyntax {
    return this.map[<string>key];
  }

  has(key: InternedString): boolean {
    return !!this.map[<string>key];
  }

  compile(compiler: CompileInto, env: Environment): CompiledNamedArgs {
    let { keys, values: rawValues } = this;
    let values = rawValues.map(v => v.compile(compiler, env));

    return CompiledNamedArgs.create({ keys, values });
  }
}

export class Templates extends Syntax {
  public type = "templates";

  static fromSpec([templateId, inverseId]: [number, number], children: CompiledInlineBlock[]): Templates {
    return new Templates({
      template: templateId === null ? null : children[templateId],
      inverse: inverseId === null ? null : children[inverseId],
    });
  }

  static empty(): Templates {
    return new Templates({ template: null, inverse: null });
  }

  static build(template: CompiledInlineBlock, inverse: CompiledInlineBlock=null): Templates {
    return new this({ template, inverse });
  }

  public default: CompiledInlineBlock;
  public inverse: CompiledInlineBlock;

  constructor(options: { template: CompiledInlineBlock, inverse: CompiledInlineBlock }) {
    super();
    this.default = options.template;
    this.inverse = options.inverse;
  }

  prettyPrint(): string {
    // let { default: _default, inverse } = this;

    // return JSON.stringify({
    //   // default: _default && _default.position,
    //   // inverse: inverse && inverse.position
    // });
    return "";
  }

  compile(compiler: CompileInto) {
    return this;
  }

  evaluate(vm: VM): PathReference {
    throw new Error("unimplemented evaluate for ExpressionSyntax");
  }
}