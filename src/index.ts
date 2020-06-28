import * as deepMerge from "deepmerge";
import * as path from "path";
import PluginContentDocs from "@docusaurus/plugin-content-docs";
import {
  PluginOptions,
  LoadedContent,
} from "@docusaurus/plugin-content-docs/lib/types";
import {
  LoadContext,
  Plugin,
} from "@docusaurus/types";

export interface MultiPluginOptions extends PluginOptions {
  id: string;
}

export interface MultiLoadedContent extends LoadedContent {
  id: string;
}

const logger = process.env.DEBUG ? console : {
  log: () => {},
};

export default function pluginContentDocs(
  context: LoadContext,
  options: MultiPluginOptions[]
): Plugin<MultiLoadedContent[] | null> {
  if (options.length === 0) {
    throw new Error("No configurations was found");
  }

  const contentDocs = options.map((opts) => ({
    id: opts.id,
    ...PluginContentDocs(context, opts),
  }));

  return {
    name: "docusaurus-plugin-content-docs",
    getThemePath() {
      return contentDocs[0].getThemePath!();
    },
    // @todo Add support for extendCli
    // extendCli
    getPathsToWatch() {
      const paths = contentDocs
        .filter((c) => c && c.getPathsToWatch)
        .reduce<string[]>((pths, c) => {
          if (c && c.getPathsToWatch) {
            return pths.concat(pths, c.getPathsToWatch());
          }
          return pths;
        }, []);

      return paths;
    },
    getClientModules() {
      const modules = [];

      let shouldIncludeAdmonitions = false;
      options.forEach(opts => {
        if (opts.admonitions) {
          shouldIncludeAdmonitions = true;
        }
      })

      if (shouldIncludeAdmonitions) {
        modules.push(require.resolve("remark-admonitions/styles/infima.css"));
      }

      return modules;
    },
    async loadContent() {
      // const contents: MultiLoadedContent[] = [];

      const contents = await Promise.all(
        contentDocs.map(async (d) => {
          if (!d || !d.loadContent) return;
          const c = await d.loadContent();
          if (c === null) return;
          return {
            id: d.id,
            ...c,
          };
        })
      );

      return (contents as MultiLoadedContent[]).filter((c) => c);
    },
    async contentLoaded({ content, actions }) {
      await Promise.all(
        contentDocs.map(async (c) => {
          if (c && c.contentLoaded && content) {
            const cntnt = content.find((cd) => cd.id === c.id);
            if (cntnt) {
              return c.contentLoaded({
                content: cntnt,
                actions: actions,
              });
            }
          }
        })
      );
    },
    configureWebpack(_config, isServer, utils) {
      const webpack = contentDocs.reduce((contents, d) => {
        if (!d || !d.configureWebpack) return contents;
        return deepMerge(
          contents,
          d.configureWebpack(_config, isServer, utils)
        );
      }, {});
      return webpack;
    },
    // docsMetadata
    // docsDir
    // docsSidebars
    // permalinkToSidebar
    // versionToSidebars
  };
}
