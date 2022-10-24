import Swagger from "@apidevtools/swagger-parser";
import {OpenAPIV3_1} from "openapi-types";
import {writeFileSync} from "fs";
import {renderFile} from "ejs";
import Document = OpenAPIV3_1.Document;
import SchemaObject = OpenAPIV3_1.SchemaObject;
import {resolve} from 'path';
// @ts-ignore
import format from 'date-format';
import Git, {Response, LogResult} from 'simple-git';

export function generate(input: string, output: string) {
    return new Swagger().validate(input, async (err, api) => {
        if (!!api) {
            const git = Git();
            let logs: any[] = [];
            try {
                const gitLogs = await git.log({file: input});
                logs = gitLogs.all.map(x => {

                    const msg = x.message;

                    const msgs = msg.split(':');

                    const version = msgs.length < 2 ? '' : msgs[0];

                    const message = msgs[1] || msgs[0];

                    return {
                        author: x.author_name,
                        version: version,
                        message: message,
                        date: format.asString('yyyy-MM-dd', new Date(x.date))
                    };
                });
            } catch (e) {
                console.log(".....", e);
            }
            const {info, components, paths = {}} = api as Document;
            const {schemas: _schemas = {}} = components || {};
            const schemaMaps: { [key: string]: string } = {};
            const schemas: SchemaObject[] = Object.keys(_schemas).map(x => {
                const schema = {..._schemas[x], field: x};
                schemaMaps[JSON.stringify(_schemas[x])] = x;
                return schema;
            });
            const apis = Object.keys(paths).map(path => {
                const methods: any = paths[path];
                return Object.keys(methods).map(method => {
                    return {
                        method: method.toUpperCase(),
                        path,
                        ...methods[method],
                        schemas: schemaMaps
                    }
                });
            }).reduce((x, y) => [...x, ...y]);

            const data = {
                info, apis, map: schemaMaps, schemas, logs
            };

            renderFile(resolve(__dirname, "../template/index.ejs"), data, (err, html) => {
                if (err) {
                    return console.log(err);
                }
                writeFileSync(output, html);
            });

        }
        return null;
    });
}