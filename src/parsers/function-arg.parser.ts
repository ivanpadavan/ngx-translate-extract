import { ParserInterface } from './parser.interface';
import { AbstractAstParser } from './abstract-ast.parser';
import { TranslationCollection } from '../utils/translation.collection';

import * as ts from 'typescript';

export class FunctionArgParser extends AbstractAstParser implements ParserInterface {

	protected _sourceFile: ts.SourceFile;

	public extract(contents: string, path?: string): TranslationCollection {
		let collection: TranslationCollection = new TranslationCollection();

		this._sourceFile = this._createSourceFile(path, contents);
		const arrowFunctionNodes = this._findArrowFunctionNodes(this._sourceFile);
		arrowFunctionNodes.forEach(arrowFunctionNode => {
			const propertyName: string = this._findTranslateServicePropertyName(arrowFunctionNode);
			if (!propertyName) {
				return;
			}

			const callNodes = this._findCallNodes(arrowFunctionNode, propertyName);
			callNodes.forEach(callNode => {
				const keys: string[] = this._getCallArgStrings(callNode);
				if (keys && keys.length) {
					collection = collection.addKeys(keys);
				}
			});
		});

		return collection;
	}

	/**
	 * Detect what the TranslateService instance property
	 * is called by inspecting constructor arguments
	 */
	protected _findTranslateServicePropertyName(arrowFunctionNode: ts.ArrowFunction): string {
		if (!arrowFunctionNode) {
			return null;
		}

		const result = arrowFunctionNode.parameters.find(parameter => {
			// Parameter has no type
			if (!parameter.type) {
				return false;
			}

			// Make sure className is of the correct type
			const parameterType: ts.Identifier = (parameter.type as ts.TypeReferenceNode).typeName as ts.Identifier;
			if (!parameterType) {
				return false;
			}
			const className: string = parameterType.text;
			if (className !== 'TranslateService') {
				return false;
			}

			return true;
		});

		if (result) {
			return (result.name as ts.Identifier).text;
		}
	}

	/**
	 * Find class nodes
	 */
	protected _findArrowFunctionNodes(node: ts.Node): ts.ArrowFunction[] {
		return this._findNodes(node, ts.SyntaxKind.ArrowFunction) as ts.ArrowFunction[];
	}

	/**
	 * Find all calls to TranslateService methods
	 */
	protected _findCallNodes(node: ts.Node, propertyIdentifier: string): ts.CallExpression[] {
		let callNodes = this._findNodes(node, ts.SyntaxKind.CallExpression) as ts.CallExpression[];
		callNodes = callNodes
			.filter(callNode => {
				// Only call expressions with arguments
				if (callNode.arguments.length < 1) {
					return false;
				}

				const propAccess = callNode.getChildAt(0).getChildAt(0) as ts.Identifier;
				if (!propAccess || propAccess.text !== propertyIdentifier) {
					return false;
				}

				const methodAccess = callNode.getChildAt(0) as ts.PropertyAccessExpression;
				if (!methodAccess || methodAccess.kind !== ts.SyntaxKind.PropertyAccessExpression) {
					return false;
				}
				if (!methodAccess.name || (methodAccess.name.text !== 'get' && methodAccess.name.text !== 'instant' && methodAccess.name.text !== 'stream')) {
					return false;
				}

				return true;
			});

		return callNodes;
	}

}
