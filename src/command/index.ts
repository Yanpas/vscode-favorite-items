import * as clipboardy from "clipboardy";
import * as path from "path";
import * as vscode from "vscode";
import { QuickPickItem } from "vscode";
import { Clipboard } from "../class/clipboard";
import { Favorites } from "../class/favorites";
import { FilesystemUtils } from "../class/filesystem";
import { GroupColor } from "../class/group-color";
import { FavoriteStorage } from "../class/storage";
import { ViewItem } from "../class/view-item";
import workspace from "../class/workspace";
import { TreeProviders, WorkspaceQuickPickItem } from "../types/index";

export class Commands {
    private clipboard = new Clipboard();
    private filesystem: FilesystemUtils = null;
    private groupColor: GroupColor = null;

    constructor(
        private context: vscode.ExtensionContext,
        public providers: TreeProviders,
        private favorites: Favorites,
        private storage: FavoriteStorage,
    ) {

        this.filesystem = new FilesystemUtils(favorites);
        this.groupColor = new GroupColor(favorites, context);

        context.subscriptions.push(this.favoritesRefresh());
        context.subscriptions.push(this.selectWorkspace());
        context.subscriptions.push(this.addExternal());
        context.subscriptions.push(this.addToFavorites());
        context.subscriptions.push(this.addToFavoritesGroup());
        context.subscriptions.push(this.deleteFavorite());
        context.subscriptions.push(this.setSortAsc());
        context.subscriptions.push(this.setSortDesc());
        context.subscriptions.push(this.collapse());
        context.subscriptions.push(this.collapseActivityView());
        context.subscriptions.push(this.createGroup());
        context.subscriptions.push(this.deleteGroup());
        context.subscriptions.push(this.addCurrentFile());
        context.subscriptions.push(this.deleteAllFavorites());
        context.subscriptions.push(this.groupRename());
        context.subscriptions.push(this.aliasModify());
        context.subscriptions.push(this.aliasRemove());

        context.subscriptions.push(this.copyPath());
        context.subscriptions.push(this.copyName());
        context.subscriptions.push(this.fsCopy());
        context.subscriptions.push(this.fsCut());
        context.subscriptions.push(this.fsPaste());
        context.subscriptions.push(this.fsCreateDirectory());
        context.subscriptions.push(this.fsCreateFile());
        context.subscriptions.push(this.fsDuplicate());
        context.subscriptions.push(this.fsDelete());
        context.subscriptions.push(this.fsRename());
        context.subscriptions.push(this.groupColorSet());
    }
    public favoritesRefresh = () => {
        return vscode.commands.registerCommand("favorites.refresh",
            () => {
                this.providers.refresh();
            });
    }
    public selectWorkspace = () => {
        return vscode.commands.registerCommand("favorites.selectWorkspace",
            () => {

                const list: WorkspaceQuickPickItem[] = vscode.workspace.workspaceFolders.map((wf, i) => {
                    const out: WorkspaceQuickPickItem = {
                        index: i,
                        label: `${wf.uri.fsPath}`,

                    };
                    return out;
                });

                vscode.window.showQuickPick(list, {
                    matchOnDescription: true,
                    matchOnDetail: true,
                    placeHolder: "Select workspace folder for Favorites",
                }).then((result) => {
                    if (!result) {
                        return;
                    }

                    return workspace.save("useWorkspace", result.index);
                }).then(() => {
                    console.log("Active folder changed");
                });

            });
    }

    public copyPath = () => {
        return vscode.commands.registerCommand("favorites.copy.path",
            (value: ViewItem) => {
                if (value == null) {
                    return;
                }
                const fsPath = value.resourceUri.fsPath;
                console.log(path);
                clipboardy.writeSync(fsPath);

            });
    }
    public copyName = () => {
        return vscode.commands.registerCommand("favorites.copy.name",
            (value: ViewItem) => {
                if (value == null) {
                    return;
                }
                const name = path.basename(value.resourceUri.fsPath);
                console.log(path);
                clipboardy.writeSync(name);

            });
    }
    public addExternal = () => {
        //
        return vscode.commands.registerCommand("favorites.addExternal",
            (value: ViewItem) => {
                console.log("favorites.addExternal");
                console.log(value);
                const shouldExit = (value == null || value.contextValue === "FAVORITE_GROUP") ? false : true;

                if (shouldExit) {
                    return;
                }

                const parentId = value == null ? null : value.id;

                Promise.all([vscode.window.showInputBox({
                    prompt: "New external resource",
                    placeHolder: "Enter file or directory path",
                })]).then((args) => {

                    const pathToAdd = args[0];

                    if (pathToAdd == null || pathToAdd.trim() === "") {
                        // vscode.window.showWarningMessage("Invalid path");
                        return;
                    }

                    return this.favorites.addExternalPathToGroup(parentId, pathToAdd);

                }).catch((e) => {
                    vscode.window.showErrorMessage(e);
                });

            });
    }

    public groupColorSet = () => {
        return vscode.commands.registerCommand("favorites.group.color.set",
            (value: ViewItem) => {

                const list: QuickPickItem[] = [
                    {
                        label: "None",
                        description: "Remove color from group",
                    },
                    {
                        label: "Custom",
                        description: "Use custom color (hex or rgb/rgba)",
                    },
                ];

                const colors: QuickPickItem[] = Object.keys(this.groupColor.colorList).map((k) => {
                    const o: QuickPickItem = {
                        label: k,
                        description: this.groupColor.colorList[k],
                    };
                    return o;
                });
                const all = list.concat(colors);

                vscode.window.showQuickPick(all, {
                    matchOnDescription: true,
                    matchOnDetail: true,
                }).then((result) => {

                    if (result == null) {
                        return Promise.resolve(null);
                    }
                    if (result.label === "None") {
                        return this.groupColor.removeColor(value.id);
                    }
                    if (result.label === "Custom") {
                        return vscode.window.showInputBox({
                            prompt: "New group color",
                            placeHolder: "Enter hex or rgb/rgba value",
                        });
                    }
                    // then desc = #hex
                    return Promise.resolve(result.description);

                }).then((input: string) => {
                    if (input == null) {
                        // no action
                        return Promise.resolve();
                    }

                    return this.groupColor.setColor(value.id, input);
                }).then(() => {
                    console.log("all ok");
                });
            });
    }
    public fsCreateFile = () => {
        return vscode.commands.registerCommand("filesystem.create.file",
            (value: ViewItem) => {
                if (value == null) {
                    return;
                }
                this.filesystem.createFile(value)
                    .then((result) => {
                        this.providers.refresh();
                    })
                    .catch((e) => {
                        this.providers.refresh();
                        console.log(e);
                    });
            });
    }
    public fsCreateDirectory = () => {
        return vscode.commands.registerCommand("filesystem.create.directory",
            (value: ViewItem) => {
                this.filesystem.createDirectory(value)
                    .then((result) => {
                        this.providers.refresh();
                    })
                    .catch((e) => {
                        this.providers.refresh();
                        console.log(e);
                    });
            });
    }
    public fsCopy = () => {
        return vscode.commands.registerCommand("filesystem.copy",
            // tslint:disable-next-line:no-empty
            (value: ViewItem) => {
                this.clipboard.copy(value);
            });
    }
    public fsCut = () => {
        return vscode.commands.registerCommand("filesystem.cut",
            // tslint:disable-next-line:no-empty
            (value: ViewItem) => {
                this.clipboard.cut(value);
            });
    }
    public fsPaste = () => {
        return vscode.commands.registerCommand("filesystem.paste",
            // tslint:disable-next-line:no-empty
            (value: ViewItem) => {
                const state = this.clipboard.get();
                if (state == null) {
                    return;
                }
                switch (state.operation) {
                    case "copy":
                        this.filesystem.copy(state.item, value)
                            .then((result) => {
                                this.providers.refresh();
                                // this.clipboard.reset();
                            })
                            .catch((e) => {
                                console.log(e);
                            });
                        break;
                    case "cut":
                        this.filesystem.move(state.item, value)
                            .then((result) => {
                                this.providers.refresh();
                                this.clipboard.reset();
                            })
                            .catch((e) => {
                                console.log(e);
                            });
                        break;
                }

            });
    }
    public fsDelete = () => {
        return vscode.commands.registerCommand("filesystem.delete",
            // tslint:disable-next-line:no-empty
            (value: ViewItem) => {
                this.filesystem.delete(value)
                    .then((result) => {
                        this.providers.refresh();
                    })
                    .catch((e) => {
                        this.providers.refresh();
                        console.log(e);
                    });
            });
    }
    public fsRename = () => {
        return vscode.commands.registerCommand("filesystem.rename",
            // tslint:disable-next-line:no-empty
            (value: ViewItem) => {
                this.filesystem.rename(value)
                    .then((result) => {
                        this.providers.refresh();
                    })
                    .catch((e) => {
                        this.providers.refresh();
                        console.log(e);
                    });
            });
    }
    public fsDuplicate = () => {
        return vscode.commands.registerCommand("filesystem.duplicate",
            // tslint:disable-next-line:no-empty
            (value: ViewItem) => {
                this.filesystem.duplicate(value)
                    .then((result) => {
                        this.providers.refresh();
                    })
                    .catch((e) => {
                        this.providers.refresh();
                        console.log(e);
                    });
            });
    }
    public aliasRemove = () => {
        return vscode.commands.registerCommand("favorites.alias.remove",
            (value: ViewItem) => {

                this.favorites.labelModify(value.id, null)
                    .then((result) => {
                        this.providers.refresh();
                    })
                    .catch((e) => {
                        console.log(e);
                    });

            });

    }
    public aliasModify = () => {
        return vscode.commands.registerCommand("favorites.alias.modify",
            (value: ViewItem) => {

                this.favorites.get()
                    .then((result) => {
                        const item = result.find((r) => r.id === value.id);
                        const oldVal = (item != null && item.label != null) ? item.label : "";
                        vscode.window.showInputBox({ prompt: "Enter alias", value: oldVal })
                            .then((name) => {
                                if (!name || name.trim().length === 0) {
                                    return;
                                }
                                const tname = name.trim();
                                this.favorites.labelModify(value.id, tname);
                                this.providers.refresh();
                            });

                    })
                    .catch((e) => {
                        console.log(e);
                    });

            });

    }
    public groupRename = () => {
        return vscode.commands.registerCommand("favorites.group.rename",
            (value: ViewItem) => {
                vscode.window.showInputBox({ prompt: "Enter new group name" })
                    .then((name) => {
                        if (!name || name.trim().length === 0) {
                            return;
                        }
                        const tname = name.trim();
                        this.favorites.groupRename(value.id, tname);
                        this.providers.refresh();
                    });

            });

    }
    public async addItemToFavorites(useGroup: boolean, fileUris: vscode.Uri[]) {
        const editor = vscode.window.activeTextEditor;
        if ((fileUris === undefined || fileUris.length === 0) && editor) {
            fileUris = [editor.document.uri];
        }

        let groupId : string|null = null;

        if (useGroup) {
            const quickPick = await this.favorites.generateGroupQuickPickList();
            if (quickPick.length === 0) {
                vscode.window.showWarningMessage("No group definition found. Create group first.");
                return;
            }
            const pickedItem = await vscode.window.showQuickPick(quickPick);
            if (pickedItem == null) {
                return;
            }
            groupId = pickedItem.id;
        }

        for (const uri of fileUris.filter(e => e && e instanceof vscode.Uri)) {
            const itemPath = uri.fsPath;
            await this.favorites.addPathToGroup(groupId, itemPath);
        }
    }
    addToFavorites = () => vscode.commands.registerCommand(
        "favorites.addToFavorites",
        async (fileUris: vscode.Uri[]) => await this.addItemToFavorites(false, fileUris)
    );
    addToFavoritesGroup = () => vscode.commands.registerCommand(
        "favorites.addToFavoritesGroup",
        async (fileUris: vscode.Uri[]) => await this.addItemToFavorites(true, fileUris)
    );
    collapse = () => {
        return vscode.commands.registerCommand("favorites.collapse", (v) => {

            this.providers.explorer.returnEmpty = true;
            this.providers.refresh();

            setTimeout(() => {
                this.providers.explorer.returnEmpty = false;
                this.providers.refresh();

            }, 400);

            console.log(v);

        });
    }
    collapseActivityView = () => {
        return vscode.commands.registerCommand("favorites.collapse.activity", (v) => {

            this.providers.activity.returnEmpty = true;
            this.providers.activity.refresh();

            setTimeout(() => {
                this.providers.activity.returnEmpty = false;
                this.providers.activity.refresh();

            }, 400);

            console.log(v);

        });
    }
    deleteFavorite = () => {
        return vscode.commands.registerCommand("favorites.deleteFavorite",
            (value: ViewItem) => {

                this.favorites.removeResource(value.id);
                this.providers.refresh();
            });
    }
    setSortAsc = () => {
        return vscode.commands.registerCommand("favorites.nav.sort.az", (value: ViewItem) => {
            const config = vscode.workspace.getConfiguration("favorites");

            vscode.commands.executeCommand("setContext", "sort", "ASC");
            return config.update("sortDirection", "ASC", false);

        });
    }
    setSortDesc = () => {
        return vscode.commands.registerCommand("favorites.nav.sort.za", (value: ViewItem) => {
            const config = vscode.workspace.getConfiguration("favorites");

            vscode.commands.executeCommand("setContext", "sort", "DESC");
            config.update("sortDirection", "DESC", false);

        });
    }
    createGroup = () => {
        return vscode.commands.registerCommand("favorites.group.create", (value: ViewItem) => {

            vscode.window.showInputBox({ prompt: "Enter group name" }).then((name) => {
                console.log(name);
                if (!name || name.trim().length === 0) {
                    return;
                }
                const tname = name.trim();
                const parentId = value == null ? null : value.id;
                this.favorites.addGroup(parentId, tname);

            });
        });
    }
    deleteGroup = () => {
        return vscode.commands.registerCommand("favorites.group.delete",
            (value: ViewItem) => {
                this.favorites.removeResource(value.id);
            });
    }
    addCurrentFile = () => {
        return vscode.commands.registerCommand("favorites.add.current", (value: any) => {
            const fsPath = vscode.window.activeTextEditor.document.fileName;
            this.favorites.addPathToGroup(null, fsPath)
                .then((result) => {
                    vscode.window.showInformationMessage(`${fsPath} added to favorites`);
                })
                .catch((e) => {
                    console.log(e);
                });
        });
    }
    deleteAllFavorites = () => {
        return vscode.commands.registerCommand("favorites.delete.all", (value: any) => {

            vscode.window.showInputBox({
                prompt: "Do you want to remove ALL favorites (including groups)?",
                placeHolder: "type 'yes' to remove everything",
            })
                .then((val) => {
                    if (val === "yes") {
                        this.storage.save([])
                            .then(() => {
                                vscode.window.showInformationMessage(`All favorites are removed`);

                            }).catch((e) => {
                                console.log(e);
                            });

                    }
                });
            //

        });
    }
}
