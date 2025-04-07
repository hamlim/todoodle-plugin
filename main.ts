import {
  type App,
  type Editor,
  type MarkdownView,
  Notice,
  //   Modal,
  Plugin,
  PluginSettingTab,
  Setting,
} from "obsidian";

interface TodoodleSettings {
  tasksDir: string;
  taskFileName: string;
  taskFileTemplate: string;
  taskId: string;
}

const DEFAULT_SETTINGS: TodoodleSettings = {
  tasksDir: "tasks",
  taskFileName: "task-{{date}}--{{time}} - {{title}}.md",
  taskFileTemplate: "_templates/task.md",
  taskId: "TASK-{{id}}",
};

export default class TodoodlePlugin extends Plugin {
  settings: TodoodleSettings;

  async onload() {
    await this.loadSettings();

    // This creates an icon in the left ribbon.
    const ribbonIconEl = this.addRibbonIcon(
      "dice",
      "Todoodle",
      (evt: MouseEvent) => {
        new Notice("Created task!");
        // @TODO
        // Called when the user clicks the icon.
        // new Notice("This is a notice!");
      },
    );
    // Perform additional things with the ribbon
    // ribbonIconEl.addClass("my-plugin-ribbon-class");

    // This adds a status bar item to the bottom of the app. Does not work on mobile apps.
    // const statusBarItemEl = this.addStatusBarItem();
    // statusBarItemEl.setText("Status Bar Text");

    // This adds a simple command that can be triggered anywhere
    // this.addCommand({
    //   id: "open-sample-modal-simple",
    //   name: "Open sample modal (simple)",
    //   callback: () => {
    //     new SampleModal(this.app).open();
    //   },
    // });
    // This adds an editor command that can perform some operation on the current editor instance
    this.addCommand({
      id: "todoodle-create-task",
      name: "Create task",
      editorCallback: (editor: Editor, view: MarkdownView) => {
        new Notice("Created task!");
        // @TODO
        // console.log(editor.getSelection());
        // editor.replaceSelection("Sample Editor Command");
      },
    });
    // This adds a complex command that can check whether the current state of the app allows execution of the command
    // this.addCommand({
    //   id: "open-sample-modal-complex",
    //   name: "Open sample modal (complex)",
    //   checkCallback: (checking: boolean) => {
    //     // Conditions to check
    //     const markdownView =
    //       this.app.workspace.getActiveViewOfType(MarkdownView);
    //     if (markdownView) {
    //       // If checking is true, we're simply "checking" if the command can be run.
    //       // If checking is false, then we want to actually perform the operation.
    //       if (!checking) {
    //         new SampleModal(this.app).open();
    //       }

    //       // This command will only show up in Command Palette when the check function returns true
    //       return true;
    //     }
    //   },
    // });

    // This adds a settings tab so the user can configure various aspects of the plugin
    this.addSettingTab(new TodoodleSettingTab(this.app, this));

    // If the plugin hooks up any global DOM events (on parts of the app that doesn't belong to this plugin)
    // Using this function will automatically remove the event listener when this plugin is disabled.
    // this.registerDomEvent(document, "click", (evt: MouseEvent) => {
    //   console.log("click", evt);
    // });

    // When registering intervals, this function will automatically clear the interval when the plugin is disabled.
    // this.registerInterval(
    //   window.setInterval(() => console.log("setInterval"), 5 * 60 * 1000),
    // );
  }

  onunload() {}

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}

// class SampleModal extends Modal {
//   constructor(app: App) {
//     super(app);
//   }

//   onOpen() {
//     const { contentEl } = this;
//     contentEl.setText("Woah!");
//   }

//   onClose() {
//     const { contentEl } = this;
//     contentEl.empty();
//   }
// }

class TodoodleSettingTab extends PluginSettingTab {
  plugin: TodoodlePlugin;

  constructor(app: App, plugin: TodoodlePlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;

    containerEl.empty();

    containerEl.createEl("h1", {
      text: "Todoodle",
    });

    containerEl.createEl("p", {
      text: "Todoodle is a plugin for Obsidian that allows you to create and manage tasks!",
    });

    let docsParent = containerEl.createEl("p");

    containerEl.createEl("span", {
      text: "All date/time formatting is done using the Dayjs library, see docs here: ",
      parent: docsParent,
    });

    containerEl.createEl("a", {
      text: "Dayjs docs",
      href: "https://day.js.org/docs/en/display/format",
      parent: docsParent,
    });

    containerEl.createEl("h2", {
      text: "Settings",
    });

    new Setting(containerEl)
      .setName("Tasks Directory")
      .setDesc("The directory where tasks are stored (defaults to './tasks')")
      .addText((text) =>
        text
          .setPlaceholder("Enter the directory where tasks are stored")
          .setValue(this.plugin.settings.tasksDir)
          .onChange(async (value) => {
            this.plugin.settings.tasksDir = value;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Task File Template")
      .setDesc("The template for task files (defaults to '_templates/task.md')")
      .addText((text) =>
        text
          .setPlaceholder("Enter the template for task files")
          .setValue(this.plugin.settings.taskFileTemplate)
          .onChange(async (value) => {
            this.plugin.settings.taskFileTemplate = value;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Task File Name")
      .setDesc(
        "The name of the task file (defaults to 'task-{{date:YYYY-MM-DD}}--{{time:hh-mm-ss}} - {{title}}.md')",
      )
      .addText((text) =>
        text
          .setPlaceholder("Enter the name of the task file")
          .setValue(this.plugin.settings.taskFileName)
          .onChange(async (value) => {
            this.plugin.settings.taskFileName = value;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Task ID")
      .setDesc("The ID of the task (defaults to 'TASK-{{id}}')")
      .addText((text) =>
        text
          .setPlaceholder("Enter the ID of the task")
          .setValue(this.plugin.settings.taskId)
          .onChange(async (value) => {
            this.plugin.settings.taskId = value;
            await this.plugin.saveSettings();
          }),
      );
  }
}
