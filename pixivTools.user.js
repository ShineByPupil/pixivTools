// ==UserScript==
// @name         P站功能加强
// @namespace    https://greasyfork.org/zh-CN/users/1296281
// @version      1.0.3
// @license      GPL-3.0
// @description  功能：1、收藏优化 2、添加收藏，自动填写标签
// @author       ShineByPupil
// @match        *://www.pixiv.net/*
// @icon         https://www.pixiv.net/favicon20250122.ico
// @grant        none
// @require      https://update.greasyfork.org/scripts/539247/1609899/%E9%80%9A%E7%94%A8%E7%BB%84%E4%BB%B6%E5%BA%93.js
// ==/UserScript==

(async function () {
  "use strict";

  // 页面类型
  const url = location.href;
  const pageType = url.includes("users")
    ? "users" // 作者
    : url.includes("artworks")
      ? "artworks" // 作品
      : url.includes("bookmark_add")
        ? "bookmark_add" // 收藏页
        : "";

  class TagsManager extends HTMLElement {
    tagsArr = [];

    constructor() {
      super();

      this.tagsArr = JSON.parse(localStorage.getItem("tagsArr"));

      this.template = document.createElement("template");
      this.template.innerHTML = `
        <mx-input placeholder="标签"></mx-input>
        <mx-input placeholder="标签别名"></mx-input>
        <mx-button class="del" type="danger">删除</mx-button>
      `;

      const htmlTemplate = document.createElement("template");
      htmlTemplate.innerHTML = `
        <mx-button class="add" type="primary">新增</mx-button>
        <div class="container"></div>
      `;

      const cssTemplate = document.createElement("template");
      cssTemplate.innerHTML = `
        <style>
          :host {
            display: block;
          }
          .container {
            max-height: 40vh;
            overflow: auto;
            display: grid;
            grid-template-columns: 1fr 1fr auto;
            gap: 6px 10px;
            margin-top: 6px;
          }
          .add {
            grid-column: 1 / -1;
          }
          .input-row {
            display: flex;
            margin-bottom: 12px;
          }
          input[type="text"] {
            flex: 1;
            padding: 8px;
            font-size: 1rem;
          }
          button {
            margin-left: 8px;
            padding: 8px 12px;
            font-size: 1rem;
            cursor: pointer;
          }
          ul {
            list-style: none;
            padding: 0;
          }
          li {
            display: flex;
            align-items: center;
            margin-bottom: 8px;
          }
          li span {
            flex: 1;
          }
          li button {
            margin-left: 4px;
            padding: 4px 8px;
            font-size: 0.9rem;
          }
        </style>
      `;

      this.attachShadow({ mode: "open" });
      this.shadowRoot.append(htmlTemplate.content, cssTemplate.content);

      this.container = this.shadowRoot.querySelector(".container");
      this.addBtn = this.shadowRoot.querySelector(".add");
    }

    connectedCallback() {
      this.addBtn.addEventListener("click", () => {
        const item = this.template.content.cloneNode(true);
        const [input1, input2, delBtn] = item.children;

        this.container.append(item);

        const handleDel = () => {
          input1.remove();
          input2.remove();
          delBtn.remove();
          delBtn.removeEventListener("click", handleDel);
        };
        delBtn.addEventListener("click", handleDel);
      });

      this.load();
    }

    load() {
      this.container.innerHTML = "";

      this.tagsArr.forEach((tag) => {
        const item = this.template.content.cloneNode(true);
        const [input1, input2, delBtn] = item.children;

        this.container.appendChild(item);

        const handleDel = () => {
          input1.remove();
          input2.remove();
          delBtn.remove();
          delBtn.removeEventListener("click", handleDel);
        };
        delBtn.addEventListener("click", handleDel);
        [input1.value, input2.value] = [tag[0], tag[1]];
      });
    }
    save() {
      this.tagsArr = Array.from(this.container.querySelectorAll("mx-input"))
        .map((n) => n.value)
        .reduce((chunks, item, index) => {
          if (index % 2 === 0) chunks.push([]);
          // 把当前项放到最后一个子数组里
          chunks[chunks.length - 1].push(item);
          return chunks;
        }, []);

      for (let i = this.tagsArr.length - 1; i >= 0; i--) {
        if (!this.tagsArr[i][0]) {
          this.tagsArr.splice(i, 1);

          continue;
        }

        if (this.tagsArr[i][0] === this.tagsArr[i][1]) {
          this.tagsArr[i][1] = "";
        }
      }

      localStorage.setItem("tagsArr", JSON.stringify(this.tagsArr));
      this.load();

      MxMessageBox.success("保存成功");
    }
  }

  customElements.define("pixiv-tools-tags-manager", TagsManager);

  // 收藏管理
  class FavoritesManager {
    illust_id = null; // 作品id
    quick_favorite_btn = null; // 收藏按钮

    constructor() {
      this.init();
    }

    init() {
      // 快速收藏
      if (["users", "artworks"].includes(pageType)) this.initQuickFavorite();

      // 自动收藏
      if (pageType === "bookmark_add") this.initAutoFavorite();
    }

    // 快速收藏
    initQuickFavorite() {
      const quickFavoriteBtn = document.createElement("div");
      quickFavoriteBtn.attachShadow({ mode: "open" });
      quickFavoriteBtn.shadowRoot.innerHTML = `
        <button>快速收藏</button>
        
        <style>
          :host {
            position: absolute;
            display: none;
          } 
        
          button {
            width: 70px;
            font-size: 12px;
            color: #fff;
            text-shadow: 1px 1px 3px #000;
            background: rgba(76, 110, 245, 0.5);
            border: 1px solid rgb(76, 110, 245);
            border-radius: 5px;
            padding: 1px 0;
            cursor: pointer;
            transition: background 0.2s;
          }
          button:hover {
            background: rgba(76, 110, 245, 0.8);
          }
        </style>
      `;

      const button = quickFavoriteBtn.shadowRoot.querySelector("button");
      document.body.appendChild(quickFavoriteBtn);
      this.quick_favorite_btn = quickFavoriteBtn;

      // 收藏按钮点击事件 - 打开收藏页
      button.addEventListener("click", () => {
        if (this.illust_id) {
          window.open(
            `https://www.pixiv.net/bookmark_add.php?type=illust&illust_id=${this.illust_id}`,
          );
        }
      });

      // 鼠标移入事件 - 在插画上显示收藏按钮
      document.addEventListener("mouseover", (e) => {
        if (e.target.tagName === "IMG") {
          const a = e.target.closest("a");
          const href = a.getAttribute("href");
          this.illust_id = href.match(/\d+$/)[0];

          const rect = a.getBoundingClientRect();
          this.quick_favorite_btn.style.left = `${rect.left + 10 + window.scrollX}px`;
          this.quick_favorite_btn.style.top = `${rect.top + 10 + window.scrollY}px`;
          this.quick_favorite_btn.style.display = "block";
        }
      });

      // 鼠标移除事件 - 隐藏收藏按钮
      document.addEventListener("mouseout", (e) => {
        if (this.quick_favorite_btn.matches(":hover")) return;
        if (e.target.tagName !== "IMG") return;

        this.quick_favorite_btn.style.display = "none";
      });

      // 页面失焦事件 - 隐藏收藏按钮
      window.addEventListener("blur", () => {
        this.quick_favorite_btn.style.display = "none";
      });
    }

    // 自动收藏
    initAutoFavorite() {
      let addForm = null; // 添加收藏表单
      let removeForm = null; // 取消收藏表单 - 同时判断是否首次收藏
      let tagsManager = document.createElement("pixiv-tools-tags-manager");

      // 功能一：提交表单后，页面自动关闭
      {
        let isSubmit = false; // 是否触发提交

        Array.from(document.forms).forEach((form) => {
          if (form.getAttribute("action")?.includes("bookmark_add")) {
            addForm = form;
          } else if (
            form.getAttribute("action")?.includes("bookmark_setting")
          ) {
            removeForm = form;
          }
        });

        addForm?.addEventListener("submit", () => (isSubmit = true));
        removeForm?.addEventListener("submit", () => (isSubmit = true));

        window.addEventListener("unload", () => {
          if (!window.closed && isSubmit) window.close();
        });
      }

      // 功能二：标签设置弹窗
      {
        const template = document.createElement("template");
        template.innerHTML = `
          <mx-dialog confirm-text="保存">
            <span slot="header">标签自动填写设置</span>
            
            <mx-button class="export" slot="button-center">导出</mx-button>
            <mx-button class="import" slot="button-center">导入</mx-button>
          </mx-dialog>
        `;
        let tagConfigDialog = template.content.firstElementChild;
        tagConfigDialog
          .querySelector(".export")
          .addEventListener("click", (e) =>
            navigator.clipboard.writeText(JSON.stringify(tagsManager.tagsArr)),
          );
        tagConfigDialog
          .querySelector(".import")
          .addEventListener("click", (e) => {
            const userInput = prompt("请输入配置：");

            if (userInput !== null) {
              tagsManager.tagsArr = JSON.parse(userInput);
              tagsManager.load();
            }
          });

        tagConfigDialog.append(tagsManager);

        tagConfigDialog.addEventListener("confirm", () => tagsManager.save());
        tagConfigDialog.addEventListener("cancel", () => tagsManager.load());

        const autoTagConfigBtn = document.createElement("div");
        autoTagConfigBtn.attachShadow({ mode: "open" });
        autoTagConfigBtn.shadowRoot.innerHTML = `
          <button id="pp-settings">
            <svg xmlns="http://www.w3.org/2000/svg" x="0px" y="0px" viewBox="0 0 1000 1000" xml:space="preserve" style="fill: white;">
              <g>
                <path d="M377.5,500c0,67.7,54.8,122.5,122.5,122.5S622.5,567.7,622.5,500S567.7,377.5,500,377.5S377.5,432.3,377.5,500z"></path><path d="M990,546v-94.8L856.2,411c-8.9-35.8-23-69.4-41.6-100.2L879,186L812,119L689,185.2c-30.8-18.5-64.4-32.6-100.2-41.5L545.9,10h-94.8L411,143.8c-35.8,8.9-69.5,23-100.2,41.5L186.1,121l-67,66.9L185.2,311c-18.6,30.8-32.6,64.4-41.5,100.3L10,454v94.8L143.8,589c8.9,35.8,23,69.4,41.6,100.2L121,814l67,67l123-66.2c30.8,18.6,64.5,32.6,100.3,41.5L454,990h94.8L589,856.2c35.8-8.9,69.4-23,100.2-41.6L814,879l67-67l-66.2-123.1c18.6-30.7,32.6-64.4,41.5-100.2L990,546z M500,745c-135.3,0-245-109.7-245-245c0-135.3,109.7-245,245-245s245,109.7,245,245C745,635.3,635.3,745,500,745z"></path>
              </g>
            </svg>
          </button>
        
          <style>
            :host {
              position: fixed;
              right: 28px;
              bottom: 100px;
              z-index: 2501;
            }
            
            button {
              background-color: var(--charcoal-surface4);
              margin-top: 5px;
              cursor: pointer;
              border: none;
              padding: 12px;
              border-radius: 24px;
              width: 48px;
              height: 48px;
              transition: background-color 0.2s;
              outline: none;
            }
            button:hover {
              background-color: var(--charcoal-surface4-hover);
            }
          </style>
        `;

        // 标签配置按钮点击事件
        autoTagConfigBtn.shadowRoot
          .querySelector("button")
          .addEventListener("click", () => tagConfigDialog.open());

        document.body.appendChild(tagConfigDialog);
        document.body.appendChild(autoTagConfigBtn);
      }

      // 功能三：新增标签，自动填充
      {
        if (!removeForm) {
          const tags = Array.from(
            document.querySelectorAll(".tag-cloud.work li span.tag"),
          ).map((n) => n.getAttribute("data-tag"));

          let result = new Set();

          tagsManager.tagsArr.forEach(([key, value]) => {
            if (tags.includes(key)) {
              result.add(value || key);
            }
          });

          const input = document.querySelector(".input-box.tags input");
          input.value = result.join(" ");
        }
      }
    }
  }

  window.messageBox = document.createElement("mx-message-box");
  document.body.appendChild(messageBox);

  new FavoritesManager();
})();
