// @ts-ignore
import dayjs from "dayjs";
import {
  type App,
  type Editor,
  type MarkdownView,
  Modal,
  Notice,
  Plugin,
  PluginSettingTab,
  Setting,
  TFile,
} from "obsidian";

function formatTemplateString(
  string: string,
  replacements?: Record<string, string>,
) {
  return string.replace(/{{([^}}]+)}}/g, (match, pattern): string => {
    // date or time
    let replacementMatch = "";
    let format = "";
    if (pattern.includes(":")) {
      [replacementMatch, format] = pattern.split(":");
    } else {
      replacementMatch = pattern;
      if (replacementMatch === "date") {
        format = "YYYY-MM-DD";
      } else if (replacementMatch === "time") {
        format = "hh-mm-ss";
      } else {
        // title or ID
        return replacements?.[replacementMatch] ?? match;
      }
    }
    return dayjs().format(format);
  });
}

interface TodoodleSettings {
  tasksDir: string;
  taskFileName: string;
  taskFileTemplate: string;
  taskId: string;
  appendFile: string;
  appendTemplate: string;
}

let DEFAULT_TASK_TEMPLATE = `- [ ] [[{{fileName}}|{{taskId}}]] ➕ {{date:YYYY-MM-DD}}`;

const DEFAULT_SETTINGS: TodoodleSettings = {
  tasksDir: "tasks",
  taskFileName: "task-{{date:YYYY-MM-DD}}--{{time:hh-mm-ss}} - {{title}}.md",
  taskFileTemplate: "_templates/task.md",
  taskId: "TASK-{{id}}",
  appendFile: "Tasks.md",
  appendTemplate: DEFAULT_TASK_TEMPLATE,
};

export default class TodoodlePlugin extends Plugin {
  settings: TodoodleSettings;

  async createTask(title: string) {
    // Get the tasks directory
    let tasksDir = this.app.vault.getAbstractFileByPath(this.settings.tasksDir);
    if (!tasksDir) {
      await this.app.vault.createFolder(this.settings.tasksDir);
      tasksDir = this.app.vault.getAbstractFileByPath(this.settings.tasksDir);
    }

    // Count existing tasks to generate ID
    let taskFiles = this.app.vault
      .getFiles()
      .filter(
        (file) =>
          file.path.startsWith(this.settings.tasksDir) &&
          file.extension === "md",
      );
    let taskId = (taskFiles.length + 1).toString();

    // Format the filename with the title
    let fileName = formatTemplateString(this.settings.taskFileName, {
      title,
    });
    let filePath = `${this.settings.tasksDir}/${fileName}`;

    // Read and format the template
    let templateFile = this.app.vault.getAbstractFileByPath(
      this.settings.taskFileTemplate,
    );
    if (!templateFile || !(templateFile instanceof TFile)) {
      throw new Error(
        `Template file not found: ${this.settings.taskFileTemplate}`,
      );
    }

    let hydratedTaskId = formatTemplateString(this.settings.taskId, {
      id: taskId,
    });

    let templateContent = await this.app.vault.read(templateFile);
    let taskContent = templateContent.replace(
      new RegExp(this.settings.taskId, "g"),
      hydratedTaskId,
    );

    // Create the task file
    await this.app.vault.create(filePath, taskContent);

    // append to a note
    if (typeof this.settings.appendFile !== "undefined") {
      let appendToFile = this.app.vault.getAbstractFileByPath(
        this.settings.appendFile,
      );
      if (!appendToFile || !(appendToFile instanceof TFile)) {
        throw new Error(
          `Append to file not found: ${this.settings.appendFile}`,
        );
      }

      let appendedTask = formatTemplateString(this.settings.appendTemplate, {
        fileName,
        taskId: hydratedTaskId,
      });

      new Notice(`Appending to ${appendToFile.path}: ${appendedTask}`);

      console.log(`Appending to ${appendToFile.path}: ${appendedTask}`);

      await this.app.vault.append(appendToFile, `\n${appendedTask}`);
    }

    new Notice(`Created task: ${title}`);
  }

  async onload() {
    await this.loadSettings();

    // This creates an icon in the left ribbon.
    const ribbonIconEl = this.addRibbonIcon(
      "dice",
      "Todoodle",
      (evt: MouseEvent) => {
        new CreateTaskModal(this.app, async (title: string) => {
          try {
            await this.createTask(title);
          } catch (err) {
            console.error(`[todoodle]: ${err.message}`);
            new Notice(`Todoodle Error: ${err.message}`);
          }
        }).open();
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
      //   editorCallback: (editor: Editor, view: MarkdownView) => {
      callback: () => {
        new CreateTaskModal(this.app, async (title: string) => {
          try {
            await this.createTask(title);
          } catch (err) {
            console.error(`[todoodle]: ${err.message}`);
            new Notice(`Todoodle Error: ${err.message}`);
          }
        }).open();
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
    // this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    let loadedSettings = await this.loadData();
    this.settings = {
      ...DEFAULT_SETTINGS,
      ...loadedSettings,
    };
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}

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

    containerEl.createEl("h3", {
      text: "Append to file",
    });

    new Setting(containerEl)
      .setName("Append to file")
      .setDesc("The file to append the task to (defaults to 'Tasks.md')")
      .addText((text) =>
        text
          .setPlaceholder("Tasks.md")
          .setValue(this.plugin.settings.appendFile ?? "")
          .onChange(async (value) => {
            this.plugin.settings.appendFile = value;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Append to file template")
      .setDesc(
        "The template to append the task to (defaults to '- [] [[{{fileName}}|{{taskId}}]] ➕{{date:YYYY-MM-DD}}')\n\nCan use `fileName` and `taskId` as placeholders.",
      )
      .addText((text) =>
        text
          .setPlaceholder("Enter the template to append the task to")
          .setValue(this.plugin.settings.appendTemplate ?? "")
          .onChange(async (value) => {
            this.plugin.settings.appendTemplate = value;
            await this.plugin.saveSettings();
          }),
      );
  }
}

class CreateTaskModal extends Modal {
  private titleInput: HTMLInputElement;
  private submitButton: HTMLButtonElement;
  private onSubmit: (title: string) => Promise<void>;

  constructor(app: App, onSubmit: (title: string) => Promise<void>) {
    super(app);
    this.onSubmit = onSubmit;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();

    // Create a container for the form
    let formContainer = contentEl.createEl("div", {
      cls: "todoodle-modal-container",
    });

    // Create the title input
    this.titleInput = formContainer.createEl("input", {
      type: "text",
      placeholder: "Enter task title",
      cls: "todoodle-title-input",
    });

    // Create the submit button
    this.submitButton = formContainer.createEl("button", {
      text: "Create Task",
      cls: "todoodle-submit-button",
    });

    // Add event listeners
    this.titleInput.addEventListener("keydown", async (e) => {
      if (e.key === "Enter") {
        await this.handleSubmit();
      }
    });

    this.submitButton.addEventListener("click", async () => {
      await this.handleSubmit();
    });

    // Focus the input
    this.titleInput.focus();
  }

  private async handleSubmit() {
    let title = this.titleInput.value.trim();
    if (title) {
      await this.onSubmit(title);
      this.close();
    }
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}
