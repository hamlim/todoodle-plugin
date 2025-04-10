// @ts-ignore
import dayjs from "dayjs";
import {
  type App,
  Modal,
  Notice,
  Plugin,
  PluginSettingTab,
  Setting,
  TFile,
} from "obsidian";

function formatDate(format: string) {
  return dayjs().format(format);
}

function formatTemplateString(
  string: string,
  replacer: (match: string, pattern: string) => string,
) {
  return string.replace(/{{([^}}]+)}}/g, replacer);
}

function createTemplateReplacer({
  title,
  id,
  fileName,
  taskId,
}: {
  title: string;
  id: string;
  fileName?: string;
  taskId?: string;
}) {
  return function templateReplacer(match: string, pattern: string) {
    if (pattern === "title") {
      return title;
    }
    if (pattern === "id") {
      return id;
    }
    if (pattern === "fileName") {
      return fileName;
    }
    if (pattern === "taskId") {
      return taskId;
    }
    if (pattern.includes(":")) {
      let [replacementMatch, format] = pattern.split(":");
      if (replacementMatch === "date") {
        return formatDate(format);
      }
      if (replacementMatch === "time") {
        return formatDate(format);
      }
    } else {
      if (pattern === "date") {
        return formatDate("YYYY-MM-DD");
      }
      if (pattern === "time") {
        return formatDate("hh-mm-ss");
      }
    }
    return match;
  };
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
  appendFile: "Inbox.md",
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

    let templateReplacer = createTemplateReplacer({
      title,
      id: taskId,
      fileName: undefined,
      taskId: undefined,
    });

    // Format the filename with the title
    let fileName = formatTemplateString(
      this.settings.taskFileName,
      templateReplacer,
    );
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

    let hydratedTaskId = formatTemplateString(
      this.settings.taskId,
      templateReplacer,
    );

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

      let appendedTask = formatTemplateString(
        this.settings.appendTemplate,
        createTemplateReplacer({
          title,
          id: taskId,
          fileName,
          taskId: hydratedTaskId,
        }),
      );

      new Notice(`Appending to ${appendToFile.path}: ${appendedTask}`);

      await this.app.vault.append(appendToFile, `\n${appendedTask}`);
    }

    new Notice(`Created task: ${title}`);
  }

  async onload() {
    await this.loadSettings();

    this.addRibbonIcon("file-check-2", "Todoodle", () => {
      new CreateTaskModal(this.app, async (title: string) => {
        try {
          await this.createTask(title);
        } catch (err) {
          console.error(`[todoodle]: ${err.message}`);
          new Notice(`Todoodle Error: ${err.message}`);
        }
      }).open();
    });

    this.addCommand({
      id: "todoodle-create-task",
      name: "Create task",
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

    this.addSettingTab(new TodoodleSettingTab(this.app, this));
  }

  onunload() {}

  async loadSettings() {
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
      .setDesc(
        "The directory where tasks are stored (defaults to './tasks')\n\nNote: Changing this directory may throw off the aliases set on each task note! If you have tasks created, make sure to move them to this new directory.",
      )
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
      .addTextArea((text) =>
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
