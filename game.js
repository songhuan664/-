// 游戏配置
const GRID_SIZE = 9;
const FRUITS = ['strawberry', 'blueberries', 'orange', 'grape', 'kiwi'];

// 关卡配置 - 11关（第1-10关为普通模式，第11关为无尽模式）
const LEVELS = [
    { goal: 150, steps: 20, skillRequirement: { skillId: 1, triggerCount: 4 }, description: '累计触发4次声东击西' }, // 第1关
    { goal: 200, steps: 25 }, // 第2关（通关后解锁技能2）
    { goal: 250, steps: 30, skillRequirement: { skillId: 2, triggerCount: 5 }, description: '累计触发5次中心爆破' }, // 第3关
    { goal: 300, steps: 30 }, // 第4关（通关后解锁技能3）
    { goal: 350, steps: 30, skillRequirement: { skillId: 3, triggerCount: 5 }, description: '累计触发5次十字激光' }, // 第5关
    { goal: 400, steps: 35 }, // 第6关（通关后解锁技能4和第二技能槽）
    { goal: 500, steps: 35, skillRequirement: { skillId: 4, triggerCount: 4 }, description: '累计触发4次全域重塑' }, // 第7关
    { goal: 600, steps: 35 }, // 第8关（通关后解锁技能5被动）
    { goal: 700, steps: 35, skillRequirement: { skillId: 5, triggerCount: 6 }, description: '累计触发6次幸运王冕' }, // 第9关
    { goal: 1000, steps: 40 }, // 第10关（通关后解锁无尽模式和地狱挑战）
    { goal: 0, steps: 0 }, // 第11关 - 无尽模式
    { goal: 4000, steps: 45, skillRequirement: { skillId: 5, triggerCount: 12 }, description: '各触发12次携带技能和幸运王冕', isHellMode: true } // 第12关 - 地狱挑战
];

// 游戏状态
let gameState = {
    currentLevel: 1,
    score: 0,
    steps: 0,
    selectedCell: null,
    gameGrid: [],
    isAnimating: false,
    skillInProgress: false, // 技能是否正在执行（用于优先级控制）
    skills: {
        1: { unlocked: true, count: 0, max: 36, auto: true, cooldown: 0 }, // 声东击西（初始解锁）- max=9*4
        2: { unlocked: false, count: 0, max: 32, auto: true, cooldown: 0 }, // 中心爆破（通关第2关解锁）- max=8*4
        3: { unlocked: false, count: 0, max: 36, auto: true, cooldown: 0, needsCooldown: false }, // 十字激光（通关第4关解锁）- max=9*4
        4: { unlocked: false, count: 0, max: 60, auto: true, cooldown: 0 }, // 全域重塑（通关第6关解锁）- max=15*4
        5: { unlocked: false, count: 0, max: 60, auto: true, cooldown: 0, passive: true }  // 幸运王冕（通关第8关解锁为被动技能）- max=15*4，默认开启被动
    },
    selectedSkills: [1], // 初始携带第一个技能
    maxSkillSlots: 1, // 初始只有1个技能槽，通关第6关后解锁第二个
    luckyCrownActive: 0,
    comboCount: 0,
    pendingRemainingGroups: null, // 待处理的剩余手动组（用于技能优先处理）
    
    // 技能待触发队列 - 用于延迟触发技能
    pendingSkillTriggers: [], // [{ skillId, requiredCount }, ...]
    
    // 动画阶段状态管理
    animationPhase: 'idle', // idle, dropping, landing, preEliminate, eliminating, processing
    isPlayerAction: true,   // 是否为玩家主动操作
    pendingLandingCells: [], // 等待播放落地动画的单元格
    isProcessingLocked: false, // 消除处理互斥锁，防止并发执行
    isAnimationLocked: false, // 动画流程锁，禁止在动画期间进行任何操作
    
    // 高亮葡萄状态 - 支持多个高亮葡萄
    highlightedGrapes: [], // [{ row, col }, ...] - 当前高亮葡萄的位置列表
    
    // 高亮葡萄触发标记 - 标记当前是否正在处理由高亮葡萄触发的消除
    highlightedGrapeTriggered: false, // 由高亮葡萄触发的消除不计入技能计数
    
    // 全域重塑冷却
    skill4CooldownRounds: 0, // 全域重塑冷却轮数
    inRound: false, // 是否正在进行一轮消除
    
    // 步数耗尽等待动画结束标记
    pendingGameOver: false, // 步数耗尽后等待动画完成再显示游戏结束弹窗
    
    // 技能触发计数（用于关卡技能要求）
    skillTriggerCounts: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
    
    // 十字激光状态管理
    crossLaserInProgress: false, // 十字激光是否正在执行
    crossLaserLocked: false, // 十字激光是否被锁定（等待消除/下落完成）
    crossLaserPendingCallback: null, // 十字激光延迟触发时的回调函数
    
    // 线性消除状态管理
    linearEliminationInProgress: false, // 是否正在执行线性消除
    
    // 全局棋盘监测状态
    boardMonitorActive: false, // 是否激活棋盘监测
    boardMonitorInterval: null, // 监测定时器ID
    consecutiveStuckFrames: 0, // 连续检测到卡住的帧数
    maxStuckFrames: 5, // 最大连续卡住帧数，超过则触发修复
    
    // 存档状态
    lastSaveTime: null // 上次保存时间
};

// 本地存储
const saveData = {
    unlockedLevels: 1,
    unlockedSkills: [1], // 初始解锁第一个技能
    totalPoints: 0,
    maxSkillSlots: 1 // 技能槽数量
};

// DOM元素
const elements = {
    mainMenu: document.getElementById('mainMenu'),
    levelMenu: document.getElementById('levelMenu'),
    skillMenuPanel: document.getElementById('skillMenuPanel'),
    skillSelect: document.getElementById('skillSelect'),
    gameInterface: document.getElementById('gameInterface'),
    levelComplete: document.getElementById('levelComplete'),
    instructionsMenu: document.getElementById('instructionsMenu'),
    startGame: document.getElementById('startGame'),
    levelSelect: document.getElementById('levelSelect'),
    skillMenu: document.getElementById('skillMenu'),
    gameInstructions: document.getElementById('gameInstructions'),
    confirmSkill: document.getElementById('confirmSkill'),
    backToLevelSelect: document.getElementById('backToLevelSelect'),
    backToMainFromSkill: document.getElementById('backToMainFromSkill'),
    restartGame: document.getElementById('restartGame'),
    completeScore: document.getElementById('结算分数'),
    backToMainBtn: document.getElementById('返回主页'),
    scoreDisplay: document.getElementById('scoreDisplay'),
    stepsDisplay: document.getElementById('stepsDisplay'),
    levelDisplay: document.getElementById('levelDisplay'),
    goalDisplay: document.getElementById('goalDisplay'),
    skillRecommendation: document.getElementById('skill-recommendation'),
    stepsLeftDisplay: document.getElementById('stepsLeftDisplay'),
    gameGrid: document.getElementById('gameGrid'),
    particlesLayer: document.getElementById('particlesLayer'),
    finalScore: document.getElementById('finalScore'),
    finalSteps: document.getElementById('finalSteps'),
    finalPoints: document.getElementById('finalPoints'),
    nextLevel: document.getElementById('nextLevel'),
    replayLevel: document.getElementById('replayLevel'),
    backToMain: document.getElementById('backToMain'),
    instructionsBack: document.getElementById('instructionsBack'),
    resetGame: document.getElementById('resetGame'),
    saveGame: document.getElementById('saveGame'),
    saveIndicator: document.getElementById('saveIndicator'),
    unlockAll: document.getElementById('unlockAll'),
    resetConfirmModal: document.getElementById('resetConfirmModal'),
    confirmReset: document.getElementById('confirmReset'),
    cancelReset: document.getElementById('cancelReset'),
    unlockModal: document.getElementById('unlockModal'),
    unlockPassword: document.getElementById('unlockPassword'),
    confirmUnlock: document.getElementById('confirmUnlock'),
    cancelUnlock: document.getElementById('cancelUnlock'),
    unlockMessage: document.getElementById('unlockMessage'),
    gameOverModal: document.getElementById('gameOverModal'),
    gameOverTitle: document.getElementById('gameOverTitle'),
    gameOverMessage: document.getElementById('gameOverMessage'),
    gameOverReplay: document.getElementById('gameOverReplay'),
    gameOverBack: document.getElementById('gameOverBack'),
    currentLevel: document.getElementById('current-level'),
    levelTarget: document.getElementById('level-target')
};

// 初始化游戏
function initGame() {
    loadSaveData();
    updateUI();
    setupEventListeners();
}

// 全局棋盘状态监测与自动修复机制

/**
 * 检查棋盘当前状态
 * @returns {Object} 包含各项状态检测结果
 */
function checkBoardState() {
    const matchGroups = findMatchGroups();
    const hasMatchableGroups = matchGroups.length > 0;
    const isProcessing = gameState.isProcessingLocked || gameState.isAnimationLocked || gameState.isAnimating;
    const isSkillInProgress = gameState.skillInProgress || gameState.crossLaserInProgress;
    const isLinearEliminating = gameState.linearEliminationInProgress;
    const isInRound = gameState.inRound;
    
    // 检查是否处于锁定状态
    const isLocked = gameState.isProcessingLocked || gameState.isAnimationLocked;
    
    return {
        hasMatchableGroups,        // 是否存在可消除的水果组
        isProcessing,              // 是否正在进行消除或检索
        isSkillInProgress,         // 是否有技能正在执行
        isLinearEliminating,       // 是否正在执行线性消除
        isInRound,                 // 是否在一轮消除中
        isLocked,                  // 是否处于锁定状态
        selectedCell: gameState.selectedCell // 当前选中的单元格
    };
}

/**
 * 判断是否需要触发自动修复
 * @returns {boolean} 是否需要修复
 */
function needsAutoRepair() {
    const state = checkBoardState();
    
    // 触发修复条件：
    // 1) 棋盘上不存在任何可检索、可消除的水果组
    // 2) 不存在任何正在进行的消除或检索行为（技能执行完成）
    // 3) 检测到锁定状态
    const condition1 = !state.hasMatchableGroups;
    const condition2 = !state.isProcessing && !state.isSkillInProgress && !state.isLinearEliminating && !state.isInRound;
    const condition3 = state.isLocked;
    
    return condition1 && condition2 && condition3;
}

/**
 * 自动修复机制 - 尝试恢复游戏逻辑至正常状态
 */
function autoRepairBoard() {
    console.log('检测到棋盘异常状态，启动自动修复...');
    
    // 重置所有锁定状态
    gameState.isProcessingLocked = false;
    gameState.isAnimationLocked = false;
    gameState.isAnimating = false;
    gameState.skillInProgress = false;
    gameState.crossLaserInProgress = false;
    gameState.crossLaserLocked = false;
    gameState.linearEliminationInProgress = false;
    gameState.inRound = false;
    
    // 清空待处理队列
    gameState.pendingSkillTriggers = [];
    gameState.pendingRemainingGroups = null;
    gameState.crossLaserPendingCallback = null;
    
    // 重置连击计数
    gameState.comboCount = 0;
    
    // 重置卡住帧数计数
    gameState.consecutiveStuckFrames = 0;
    
    // 检查是否需要重新生成可消除的水果组
    const matchGroups = findMatchGroups();
    if (matchGroups.length === 0) {
        console.log('棋盘无可消除组，尝试重新生成...');
        regenerateMatchableFruits();
    }
    
    console.log('自动修复完成，棋盘状态已恢复');
}

/**
 * 重新生成可消除的水果组
 * 通过交换随机水果位置来创建可消除的组合
 */
function regenerateMatchableFruits() {
    let attempts = 0;
    const maxAttempts = 10;
    
    while (attempts < maxAttempts) {
        // 随机选择两个不同的位置
        const row1 = Math.floor(Math.random() * GRID_SIZE);
        const col1 = Math.floor(Math.random() * GRID_SIZE);
        let row2, col2;
        
        // 确保选择不同的位置
        do {
            row2 = Math.floor(Math.random() * GRID_SIZE);
            col2 = Math.floor(Math.random() * GRID_SIZE);
        } while (row1 === row2 && col1 === col2);
        
        // 交换水果
        const temp = gameState.gameGrid[row1][col1];
        gameState.gameGrid[row1][col1] = gameState.gameGrid[row2][col2];
        gameState.gameGrid[row2][col2] = temp;
        
        // 检查是否有可消除的组
        if (findMatchGroups().length > 0) {
            // 更新UI
            renderGrid();
            console.log(`成功生成可消除组，尝试次数: ${attempts + 1}`);
            return;
        }
        
        // 交换回来
        gameState.gameGrid[row2][col2] = gameState.gameGrid[row1][col1];
        gameState.gameGrid[row1][col1] = temp;
        
        attempts++;
    }
    
    console.log('无法通过交换生成可消除组，需要重新初始化棋盘');
    // 如果无法通过交换生成，重新初始化棋盘
    initializeGrid();
    renderGrid();
}

/**
 * 启动棋盘监测
 */
function startBoardMonitor() {
    if (gameState.boardMonitorActive) {
        console.log('棋盘监测已在运行中');
        return;
    }
    
    gameState.boardMonitorActive = true;
    console.log('启动棋盘监测系统');
    
    // 每200ms检查一次棋盘状态
    gameState.boardMonitorInterval = setInterval(() => {
        if (needsAutoRepair()) {
            gameState.consecutiveStuckFrames++;
            
            console.log(`检测到异常状态，连续卡住帧: ${gameState.consecutiveStuckFrames}`);
            
            // 连续检测到多次卡住才触发修复，避免误触发
            if (gameState.consecutiveStuckFrames >= gameState.maxStuckFrames) {
                autoRepairBoard();
            }
        } else {
            // 状态正常，重置计数
            gameState.consecutiveStuckFrames = 0;
        }
    }, 200);
}

/**
 * 停止棋盘监测
 */
function stopBoardMonitor() {
    if (!gameState.boardMonitorActive) {
        return;
    }
    
    clearInterval(gameState.boardMonitorInterval);
    gameState.boardMonitorInterval = null;
    gameState.boardMonitorActive = false;
    gameState.consecutiveStuckFrames = 0;
    console.log('停止棋盘监测系统');
}

// 加载保存数据
function loadSaveData() {
    const saved = localStorage.getItem('thunderMatch3');
    if (saved) {
        const data = JSON.parse(saved);
        saveData.unlockedLevels = data.unlockedLevels || 1;
        saveData.unlockedSkills = data.unlockedSkills || [];
        saveData.totalPoints = data.totalPoints || 0;
        saveData.maxSkillSlots = data.maxSkillSlots || 1;
        gameState.maxSkillSlots = saveData.maxSkillSlots;
        
        // 解锁技能
        saveData.unlockedSkills.forEach(skillId => {
            gameState.skills[skillId].unlocked = true;
        });
    }
}

// 保存数据
function saveGameData() {
    localStorage.setItem('thunderMatch3', JSON.stringify(saveData));
    showSaveIndicator();
}

// 显示保存指示器
function showSaveIndicator() {
    elements.saveIndicator.classList.remove('hidden');
    setTimeout(() => {
        elements.saveIndicator.classList.add('hidden');
    }, 2000);
}

// 手动保存游戏
function manualSaveGame() {
    saveGameData();
    console.log('游戏已手动保存');
}

// 自动保存游戏（关卡完成时）
function autoSaveOnLevelComplete() {
    saveGameData();
    console.log('关卡完成，游戏已自动保存');
}

// 更新UI
function updateUI() {
    // 更新关卡选择（更新所有12个关卡）
    for (let i = 1; i <= 12; i++) {
        const levelItem = document.querySelector(`.level-item[data-level="${i}"]`);
        if (levelItem) {
            if (i <= saveData.unlockedLevels) {
                levelItem.classList.remove('locked');
            } else {
                levelItem.classList.add('locked');
            }
        }
    }
    
    // 更新技能系统
    for (let i = 1; i <= 5; i++) {
        const skillItem = document.querySelector(`.skill-item[data-skill="${i}"]`);
        const skillSelectItem = document.querySelector(`.skill-select-item[data-skill="${i}"]`);
        
        if (skillItem) {
            if (gameState.skills[i].unlocked) {
                skillItem.classList.remove('locked');
            } else {
                skillItem.classList.add('locked');
            }
        }
        
        if (skillSelectItem) {
            if (gameState.skills[i].unlocked) {
                skillSelectItem.classList.remove('locked');
            } else {
                skillSelectItem.classList.add('locked');
            }
        }
    }
}

// 设置事件监听器
function setupEventListeners() {
    // 主菜单按钮
    elements.levelSelect.addEventListener('click', showLevelMenu);
    elements.skillMenu.addEventListener('click', showSkillMenu);
    elements.gameInstructions.addEventListener('click', showInstructionsMenu);
    elements.resetGame.addEventListener('click', showResetConfirmModal);
    elements.saveGame.addEventListener('click', manualSaveGame);
    elements.unlockAll.addEventListener('click', showUnlockModal);
    
    // 重置游戏确认弹窗
    elements.confirmReset.addEventListener('click', resetGameData);
    elements.cancelReset.addEventListener('click', hideResetConfirmModal);
    
    // 破解权限弹窗
    elements.confirmUnlock.addEventListener('click', checkUnlockPassword);
    elements.cancelUnlock.addEventListener('click', hideUnlockModal);
    
    // 游戏结束弹窗
    elements.gameOverReplay.addEventListener('click', () => {
        elements.gameOverModal.classList.add('hidden');
        startNewGame(gameState.currentLevel);
    });
    elements.gameOverBack.addEventListener('click', () => {
        elements.gameOverModal.classList.add('hidden');
        showMainMenu();
    });
    
    // 游戏说明界面
    elements.instructionsBack.addEventListener('click', showMainMenu);
    
    // 游戏说明选项卡切换
    document.querySelectorAll('.tab-button').forEach(button => {
        button.addEventListener('click', () => {
            const tabName = button.dataset.tab;
            switchTab(tabName);
        });
    });
    
    // 关卡选择
    document.querySelectorAll('.level-item').forEach(item => {
        item.addEventListener('click', () => {
            const level = parseInt(item.dataset.level);
            if (level <= saveData.unlockedLevels) {
                startNewGame(level);
            }
        });
    });
    
    // 技能选择
    document.querySelectorAll('.skill-select-item').forEach(item => {
        item.addEventListener('click', () => {
            const skill = parseInt(item.dataset.skill);
            if (gameState.skills[skill].unlocked) {
                if (gameState.maxSkillSlots >= 2) {
                    // 可携带两个技能
                    if (gameState.selectedSkills.includes(skill)) {
                        gameState.selectedSkills = gameState.selectedSkills.filter(s => s !== skill);
                        item.classList.remove('selected');
                    } else if (gameState.selectedSkills.length < gameState.maxSkillSlots) {
                        gameState.selectedSkills.push(skill);
                        item.classList.add('selected');
                    }
                } else {
                    // 只能选择一个技能
                    gameState.selectedSkills = [skill];
                    document.querySelectorAll('.skill-select-item').forEach(i => i.classList.remove('selected'));
                    item.classList.add('selected');
                }
                // 更新技能槽位显示
                updateSkillSlotDisplay();
            }
        });
    });
    
    // 确认技能选择
    elements.confirmSkill.addEventListener('click', startGameWithSkills);
    
    // 高亮葡萄帮助按钮
    document.querySelectorAll('.highlight-grape-help-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.getElementById('highlightGrapeModal').classList.remove('hidden');
        });
    });
    
    // 关闭高亮葡萄说明弹窗
    document.getElementById('closeHighlightGrapeModal').addEventListener('click', () => {
        document.getElementById('highlightGrapeModal').classList.add('hidden');
    });

    // 得分规则帮助按钮事件
    document.getElementById('scoreRulesHelpBtn').addEventListener('click', () => {
        document.getElementById('scoreRulesModal').classList.remove('hidden');
    });

    document.getElementById('closeScoreRulesModal').addEventListener('click', () => {
        document.getElementById('scoreRulesModal').classList.add('hidden');
    });
    
    // 返回关卡选择
    elements.backToLevelSelect.addEventListener('click', showLevelMenu);
    
    // 返回主页（技能选择界面）
    elements.backToMainFromSkill.addEventListener('click', showMainMenu);
    
    // 游戏界面按钮
    elements.restartGame.addEventListener('click', () => startNewGame(gameState.currentLevel));
    elements.completeScore.addEventListener('click', () => {
        // 主动结算时，先检查是否达到胜利条件
        if (checkLevelComplete()) {
            completeLevel();
        } else {
            // 未达到条件，显示失败弹窗
            const levelConfig = LEVELS[gameState.currentLevel - 1];
            let msg = '未达到目标，结算失败！';
            if (gameState.score < levelConfig.goal) {
                msg = `分数未达到 ${levelConfig.goal} 分！`;
            } else if (levelConfig.skillRequirement) {
                msg = `${levelConfig.description}！`;
            }
            elements.gameOverTitle.textContent = '结算失败';
            elements.gameOverMessage.textContent = msg;
            elements.gameOverModal.classList.remove('hidden');
        }
    });
    elements.backToMainBtn.addEventListener('click', showMainMenu);
    
    // 被动技能开关按钮
    const passiveToggleBtn = document.getElementById('passiveToggleBtn');
    if (passiveToggleBtn) {
        passiveToggleBtn.addEventListener('click', () => {
            const skill5 = gameState.skills[5];
            if (skill5.unlocked) {
                // 切换被动技能状态
                skill5.passive = !skill5.passive;
                console.log(`幸运王冕被动状态: ${skill5.passive ? '开启' : '关闭'}`);
                updatePassiveSkillSlot();
            }
        });
    }
    
    // 关卡结算按钮
    elements.nextLevel.addEventListener('click', () => startNewGame(gameState.currentLevel + 1));
    elements.replayLevel.addEventListener('click', () => startNewGame(gameState.currentLevel));
    elements.backToMain.addEventListener('click', showMainMenu);
    
    // 空格键触发技能
    document.addEventListener('keydown', (e) => {
        // 检查是否有动画或技能正在执行，或者十字激光正在执行
        if (!gameState.isAnimating && !gameState.skillInProgress && !gameState.crossLaserInProgress) {
            // 数字1触发第一个技能
            if (e.code === 'Digit1') {
                const skillId = gameState.selectedSkills[0];
                if (skillId) {
                    const requiredCount = skillId === 1 ? 9 : skillId === 2 ? 8 : skillId === 3 ? 9 : 15;
                    if (gameState.skills[skillId].count >= requiredCount) {
                        // 消耗技能所需的水果数量
                        gameState.skills[skillId].count -= requiredCount;
                        if (gameState.skills[skillId].count < 0) {
                            gameState.skills[skillId].count = 0;
                        }
                        
                        switch (skillId) {
                            case 1:
                                useSkill1();
                                break;
                            case 2:
                                useSkill2();
                                break;
                            case 3:
                                // 手动触发十字激光也使用延迟回调版本
                                executeSkill3WithDelay(null);
                                break;
                            case 4:
                                useSkill4();
                                break;
                        }
                    }
                }
            }
            
            // 数字2触发第二个技能（当有两个技能槽时）
            if (e.code === 'Digit2' && gameState.maxSkillSlots >= 2) {
                const skillId = gameState.selectedSkills[1];
                if (skillId) {
                    const requiredCount = skillId === 1 ? 9 : skillId === 2 ? 8 : skillId === 3 ? 9 : 15;
                    if (gameState.skills[skillId].count >= requiredCount) {
                        // 消耗技能所需的水果数量
                        gameState.skills[skillId].count -= requiredCount;
                        if (gameState.skills[skillId].count < 0) {
                            gameState.skills[skillId].count = 0;
                        }
                        
                        switch (skillId) {
                            case 1:
                                useSkill1();
                                break;
                            case 2:
                                useSkill2();
                                break;
                            case 3:
                                // 手动触发十字激光也使用延迟回调版本
                                executeSkill3WithDelay(null);
                                break;
                            case 4:
                                useSkill4();
                                break;
                        }
                    }
                }
            }
        }
    });
    
    // 返回按钮
    document.querySelectorAll('.back-button').forEach(button => {
        button.addEventListener('click', showMainMenu);
    });
}

// 显示主菜单
function showMainMenu() {
    document.body.classList.remove('in-game');
    elements.mainMenu.classList.remove('hidden');
    elements.levelMenu.classList.add('hidden');
    elements.skillMenuPanel.classList.add('hidden');
    elements.skillSelect.classList.add('hidden');
    elements.gameInterface.classList.add('hidden');
    elements.levelComplete.classList.add('hidden');
    elements.instructionsMenu.classList.add('hidden');
    hideResetConfirmModal();
    hideUnlockModal();
    
    // 停止棋盘监测系统
    stopBoardMonitor();
}

// 显示重置确认弹窗
function showResetConfirmModal() {
    elements.resetConfirmModal.classList.remove('hidden');
}

// 隐藏重置确认弹窗
function hideResetConfirmModal() {
    elements.resetConfirmModal.classList.add('hidden');
}

// 重置游戏数据
function resetGameData() {
    // 清除粒子效果
    stopCrownParticleEffect();
    
    // 清除localStorage数据
    localStorage.removeItem('thunderMatch3');
    
    // 重置saveData
    saveData.unlockedLevels = 1;
    saveData.unlockedSkills = [1]; // 声东击西始终解锁
    saveData.totalPoints = 0;
    saveData.maxSkillSlots = 1; // 重置技能槽数量为1
    
    // 重置游戏状态
    gameState.selectedSkills = [];
    gameState.maxSkillSlots = 1; // 重置技能槽数量为1
    for (let i = 1; i <= 5; i++) {
        gameState.skills[i].unlocked = (i === 1); // 声东击西始终解锁
        gameState.skills[i].count = 0;
        gameState.skills[i].auto = false;
    }
    
    // 更新UI
    updateUI();
    hideResetConfirmModal();
}

// 显示破解权限弹窗
function showUnlockModal() {
    elements.unlockModal.classList.remove('hidden');
    elements.unlockPassword.value = '';
    elements.unlockMessage.textContent = '';
    elements.unlockMessage.className = 'message';
}

// 隐藏破解权限弹窗
function hideUnlockModal() {
    elements.unlockModal.classList.add('hidden');
}

// 检查解锁密码
function checkUnlockPassword() {
    const password = elements.unlockPassword.value;
    if (password === '1') {
        // 解锁全部内容
        saveData.unlockedLevels = 12; // 包含无尽模式和地狱挑战
        saveData.unlockedSkills = [1, 2, 3, 4, 5];
        saveData.maxSkillSlots = 2; // 解锁第二个技能槽
        
        // 更新游戏状态
        for (let i = 1; i <= 5; i++) {
            gameState.skills[i].unlocked = true;
        }
        gameState.maxSkillSlots = 2;
        
        // 保存数据
        saveGameData();
        
        // 更新UI
        updateUI();
        
        // 立即关闭弹窗
        hideUnlockModal();
        
        // 在屏幕中间显示成功提示
        showUnlockSuccessMessage();
    } else {
        // 显示错误消息
        elements.unlockMessage.textContent = '密码错误！';
        elements.unlockMessage.className = 'message error';
    }
}

// 显示解锁成功提示
function showUnlockSuccessMessage() {
    // 创建提示元素
    const successDiv = document.createElement('div');
    successDiv.className = 'unlock-success';
    successDiv.textContent = '已解锁全部游戏内容！';
    document.body.appendChild(successDiv);
    
    // 3秒后移除提示
    setTimeout(() => {
        successDiv.remove();
    }, 3000);
}

// 更新技能槽位显示
function updateSkillSlotDisplay() {
    const slot1 = document.querySelector('.skill-slot-display[data-slot="1"]');
    const slot2 = document.querySelector('.skill-slot-display[data-slot="2"]');
    const slot1Icon = document.getElementById('slot1-icon');
    const slot2Icon = document.getElementById('slot2-icon');
    
    // 更新技能槽1
    if (slot1 && slot1Icon) {
        if (gameState.selectedSkills[0]) {
            const skillId = gameState.selectedSkills[0];
            slot1Icon.className = 'slot-icon';
            slot1Icon.style.backgroundImage = getSkillIcon(skillId);
            slot1.classList.remove('locked');
        } else {
            slot1Icon.className = 'slot-icon empty';
            slot1Icon.style.backgroundImage = '';
        }
    }
    
    // 更新技能槽2
    if (slot2 && slot2Icon) {
        if (gameState.maxSkillSlots >= 2) {
            slot2.classList.remove('locked');
            if (gameState.selectedSkills[1]) {
                const skillId = gameState.selectedSkills[1];
                slot2Icon.className = 'slot-icon';
                slot2Icon.style.backgroundImage = getSkillIcon(skillId);
            } else {
                slot2Icon.className = 'slot-icon empty';
                slot2Icon.style.backgroundImage = '';
            }
        } else {
            slot2.classList.add('locked');
            slot2Icon.className = 'slot-icon locked';
            slot2Icon.style.backgroundImage = '';
        }
    }
}

// 获取技能图标
function getSkillIcon(skillId) {
    const icons = {
        1: "url('images/strawberry.png')", // 草莓
        2: "url('images/blueberries.png')", // 蓝莓
        3: "url('images/orange.png')", // 橙子
        4: "url('images/grape.png')", // 葡萄
        5: "url('images/kiwi.png')"  // 猕猴桃
    };
    return icons[skillId] || '';
}

// 显示关卡选择
function showLevelMenu() {
    // 清空技能选择状态，确保选择关卡后显示技能选择界面
    gameState.selectedSkills = [];
    elements.mainMenu.classList.add('hidden');
    elements.skillSelect.classList.add('hidden');
    elements.levelMenu.classList.remove('hidden');
}

// 显示技能系统
function showSkillMenu() {
    elements.mainMenu.classList.add('hidden');
    elements.skillMenuPanel.classList.remove('hidden');
}

// 显示游戏说明
function showInstructionsMenu() {
    elements.mainMenu.classList.add('hidden');
    elements.instructionsMenu.classList.remove('hidden');
    // 默认显示第一个选项卡
    switchTab('rules');
}

// 切换选项卡
function switchTab(tabName) {
    // 更新按钮状态
    document.querySelectorAll('.tab-button').forEach(button => {
        button.classList.remove('active');
        if (button.dataset.tab === tabName) {
            button.classList.add('active');
        }
    });
    
    // 更新内容显示
    document.querySelectorAll('.instruction-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    document.getElementById(`${tabName}-tab`).classList.add('active');
}

// 开始新游戏
function startNewGame(level) {
    // 保存当前已选择的技能（重新开始同一关卡时保留）
    const savedSkills = [...gameState.selectedSkills];
    // 保存旧的关卡号，用于判断是否是重新开始同一关卡
    const oldLevel = gameState.currentLevel;
    
    gameState.currentLevel = level;
    gameState.score = 0;
    gameState.steps = 0;
    gameState.selectedCell = null;
    gameState.isAnimating = false;
    gameState.pendingGameOver = false;
    gameState.luckyCrownActive = 0;
    gameState.comboCount = 0;
    
    // 重置技能计数
    for (let i = 1; i <= 5; i++) {
        gameState.skills[i].count = 0;
    }
    
    // 重置技能触发计数（用于关卡技能要求）
    gameState.skillTriggerCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    
    // 如果是重新开始当前关卡且已有选择的技能，保留技能选择
    // 否则每次进入关卡前都要显示技能选择界面
    if (level === oldLevel && savedSkills.length > 0) {
        gameState.selectedSkills = savedSkills;
        // 直接进入游戏
        document.body.classList.add('in-game');
        initializeGrid();
        renderGrid();
        updateGameInfo();
        
        elements.mainMenu.classList.add('hidden');
        elements.levelMenu.classList.add('hidden');
        elements.skillMenuPanel.classList.add('hidden');
        elements.skillSelect.classList.add('hidden');
        elements.gameInterface.classList.remove('hidden');
        elements.levelComplete.classList.add('hidden');
        
        // 设置网格点击事件
        elements.gameGrid.addEventListener('click', handleCellClick);
        return;
    }
    
    // 新关卡或没有选择技能，显示技能选择界面
    gameState.selectedSkills = [];
    
    // 清空所有技能选择项的高亮状态
    document.querySelectorAll('.skill-select-item').forEach(item => {
        item.classList.remove('selected');
    });
    
    // 隐藏所有菜单，直接显示技能选择界面
    elements.mainMenu.classList.add('hidden');
    elements.levelMenu.classList.add('hidden');
    elements.skillMenuPanel.classList.add('hidden');
    elements.skillSelect.classList.remove('hidden');
    elements.gameInterface.classList.add('hidden');
    elements.levelComplete.classList.add('hidden');
    
    // 更新关卡信息显示
    updateLevelInfo();
    
    // 更新技能槽位显示
    updateSkillSlotDisplay();
    
    // 重新初始化悬停提示（技能解锁状态可能已变化）
    initSkillTooltips();
}

// 带技能开始游戏
function startGameWithSkills() {
    document.body.classList.add('in-game');
    initializeGrid();
    renderGrid();
    updateGameInfo();
    
    // 隐藏所有菜单，显示游戏界面
    elements.skillSelect.classList.add('hidden');
    elements.gameInterface.classList.remove('hidden');
    elements.mainMenu.classList.add('hidden');
    elements.levelMenu.classList.add('hidden');
    elements.skillMenuPanel.classList.add('hidden');
    elements.levelComplete.classList.add('hidden');
    
    // 设置网格点击事件
    elements.gameGrid.addEventListener('click', handleCellClick);
    
    // 启动棋盘监测系统
    startBoardMonitor();
}

// 初始化网格
function initializeGrid() {
    gameState.gameGrid = [];
    for (let row = 0; row < GRID_SIZE; row++) {
        gameState.gameGrid[row] = [];
        for (let col = 0; col < GRID_SIZE; col++) {
            gameState.gameGrid[row][col] = getRandomFruit(row, col);
        }
    }
    
    // 确保初始没有可消除的组合
    while (hasMatches()) {
        initializeGrid();
    }
}

// 获取随机水果
function getRandomFruit(row, col) {
    let fruit;
    let attempts = 0;
    do {
        fruit = FRUITS[Math.floor(Math.random() * FRUITS.length)];
        attempts++;
        if (attempts > 10) break;
    } while (hasAdjacentMatches(row, col, fruit));
    return fruit;
}

// 检查相邻匹配
function hasAdjacentMatches(row, col, fruit) {
    let count = 0;
    
    if (col > 0 && gameState.gameGrid[row][col - 1] === fruit) count++;
    if (col > 1 && gameState.gameGrid[row][col - 2] === fruit) count++;
    if (row > 0 && gameState.gameGrid[row - 1][col] === fruit) count++;
    if (row > 1 && gameState.gameGrid[row - 2][col] === fruit) count++;
    
    return count >= 2;
}

// 检查是否有匹配
function hasMatches() {
    for (let row = 0; row < GRID_SIZE; row++) {
        for (let col = 0; col < GRID_SIZE; col++) {
            const horizontalMatch = checkHorizontalMatch(row, col);
            const verticalMatch = checkVerticalMatch(row, col);
            
            if (horizontalMatch.length >= 3 || verticalMatch.length >= 3) {
                return true;
            }
        }
    }
    return false;
}

// 渲染网格
function renderGrid() {
    elements.gameGrid.innerHTML = '';

    for (let row = 0; row < GRID_SIZE; row++) {
        for (let col = 0; col < GRID_SIZE; col++) {
            const fruit = gameState.gameGrid[row][col];
            if (fruit) {
                const cell = document.createElement('div');
                cell.className = `grid-cell fruit-${fruit}`;
                
                // 检查是否为高亮葡萄
                if (isHighlightedGrape(row, col)) {
                    cell.classList.add('highlighted-grape');
                }
                
                cell.dataset.row = row;
                cell.dataset.col = col;
                elements.gameGrid.appendChild(cell);
            } else {
                // 空格子不创建DOM元素，使用背景网格显示
                const cell = document.createElement('div');
                cell.className = 'grid-cell empty-cell';
                cell.dataset.row = row;
                cell.dataset.col = col;
                elements.gameGrid.appendChild(cell);
            }
        }
    }

    // 更新技能进度
    updateSkillProgress();
}

// 更新游戏信息
function updateGameInfo() {
    elements.scoreDisplay.textContent = gameState.score;
    elements.stepsDisplay.textContent = gameState.steps;
    
    const levelConfig = LEVELS[gameState.currentLevel - 1];
    
    if (gameState.currentLevel <= 10) {
        // 第1-10关：显示普通关卡目标
        elements.levelDisplay.textContent = `关卡：${gameState.currentLevel}`;
        let goalText = `目标分数: ${levelConfig.goal}分`;
        // 如果有技能触发要求，添加显示
        if (levelConfig.skillRequirement) {
            const { skillId, triggerCount } = levelConfig.skillRequirement;
            const currentCount = gameState.skillTriggerCounts[skillId] || 0;
            const skillNames = {
                1: '声东击西',
                2: '中心爆破',
                3: '十字激光',
                4: '全域重塑',
                5: '幸运王冕'
            };
            goalText += `  |  ${skillNames[skillId]}: ${currentCount}/${triggerCount}`;
        }
        // 将剩余步数也加入到goalText中，用竖线隔开
        goalText += `  |  剩余步数: ${levelConfig.steps - gameState.steps}`;
        elements.goalDisplay.textContent = goalText;
        elements.stepsLeftDisplay.textContent = ''; // 清空原来的剩余步数显示
        // 更新技能触发次数弹窗（隐藏）
        updateSkillTriggerModal();
    } else if (gameState.currentLevel === 11) {
        // 第11关：无尽模式
        elements.levelDisplay.textContent = '关卡：11';
        elements.goalDisplay.textContent = '无尽模式';
        elements.stepsLeftDisplay.textContent = '无步数限制';
        // 更新技能触发次数弹窗（隐藏）
        updateSkillTriggerModal();
    } else if (gameState.currentLevel === 12) {
        // 第12关：地狱挑战模式
        elements.levelDisplay.textContent = '地狱挑战';
        let goalText = `目标分数: ${levelConfig.goal}分`;
        // 不显示技能要求在顶部，改用弹窗显示
        goalText += `  |  剩余步数: ${levelConfig.steps - gameState.steps}`;
        elements.goalDisplay.textContent = goalText;
        elements.stepsLeftDisplay.textContent = ''; // 清空右边的内容
        // 更新技能触发次数弹窗（显示）
        updateSkillTriggerModal();
    }
}

// 更新技能触发次数弹窗
function updateSkillTriggerModal() {
    const modal = document.getElementById('skillTriggerModal');
    const list = document.getElementById('skillTriggerList');
    
    if (!modal || !list) return;
    
    // 地狱挑战模式显示弹窗
    if (gameState.currentLevel === 12) {
        modal.classList.remove('hidden');
        
        const skillNames = {
            1: '声东击西',
            2: '中心爆破',
            3: '十字激光',
            4: '全域重塑',
            5: '幸运王冕'
        };
        
        // 获取关卡配置中的触发次数要求
        const levelConfig = LEVELS[gameState.currentLevel - 1];
        const triggerCount = levelConfig.skillRequirement ? levelConfig.skillRequirement.triggerCount : 6;
        
        let html = '';
        
        // 显示玩家携带的两个主动技能
        if (gameState.selectedSkills && gameState.selectedSkills.length > 0) {
            gameState.selectedSkills.forEach(skillId => {
                if (skillId && skillId !== 5) { // 排除被动技能幸运王冕
                    const currentCount = gameState.skillTriggerCounts[skillId] || 0;
                    html += `<p>${skillNames[skillId]}：${currentCount}/${triggerCount}</p>`;
                }
            });
        }
        
        // 始终显示幸运王冕（被动技能）
        const luckyCrownCount = gameState.skillTriggerCounts[5] || 0;
        html += `<p>幸运王冕：${luckyCrownCount}/${triggerCount}</p>`;
        
        list.innerHTML = html;
    } else {
        modal.classList.add('hidden');
    }
}

// 更新技能进度
function updateSkillProgress() {
    // 始终显示两个技能槽
    for (let slotIndex = 0; slotIndex < 2; slotIndex++) {
        const skillId = gameState.selectedSkills[slotIndex];
        const progressBar = document.querySelector(`.progress-bar[data-skill="${slotIndex + 1}"]`);
        
        if (!progressBar) continue;
        
        progressBar.style.display = 'block';
        progressBar.classList.remove('empty-slot');
        
        if (skillId) {
            // 有携带技能，正常显示
            progressBar.classList.remove('empty-slot');
            
            // 添加技能图标
            let skillIcon = progressBar.querySelector('.skill-icon-display');
            if (!skillIcon) {
                skillIcon = document.createElement('div');
                skillIcon.className = 'skill-icon-display';
                progressBar.appendChild(skillIcon);
            }
            skillIcon.className = 'skill-icon-display';
            skillIcon.style.backgroundImage = getSkillIcon(skillId);
            
            // 添加技能名称
            let skillNameElement = progressBar.querySelector('.skill-name');
            if (!skillNameElement) {
                skillNameElement = document.createElement('div');
                skillNameElement.className = 'skill-name';
                progressBar.appendChild(skillNameElement);
            }
            const skillNames = {
                1: '声东击西',
                2: '中心爆破',
                3: '十字激光',
                4: '全域重塑',
                5: '幸运王冕'
            };
            skillNameElement.textContent = skillNames[skillId] || '';
            
            // 设置技能名称颜色和图标边框颜色为对应水果颜色
            const skillColors = {
                1: '#e74c3c', // 草莓红
                2: '#3498db', // 蓝莓蓝（中心爆破）
                3: '#f39c12', // 橙子橙
                4: '#9b59b6', // 葡萄紫
                5: '#27ae60'  // 猕猴桃绿（幸运王冕）
            };
            skillNameElement.style.color = skillColors[skillId] || '#666';
            skillIcon.style.borderColor = skillColors[skillId] || '#4CAF50';
            
            // 添加技能效果描述
            let skillEffect = '';
            switch (skillId) {
                case 1:
                    skillEffect = '随机消除两处2×2区域';
                    break;
                case 2:
                    skillEffect = '随机消除一处3×3区域';
                    break;
                case 3:
                    skillEffect = '消除十字区域内所有水果';
                    break;
                case 4:
                    skillEffect = '将葡萄转化为高亮葡萄';
                    break;
                case 5:
                    skillEffect = '被动: 5次消除额外+12分';
                    break;
            }
            
            // 添加进度容器
            let progressContainer = progressBar.querySelector('.progress-container');
            if (!progressContainer) {
                progressContainer = document.createElement('div');
                progressContainer.className = 'progress-container';
                progressBar.appendChild(progressContainer);
                
                const progressFill = document.createElement('div');
                progressFill.className = 'progress-fill';
                progressContainer.appendChild(progressFill);
            }
            
            // 更新进度条
            const progressFill = progressContainer.querySelector('.progress-fill');
            // 修改技能触发所需水果数量：全域重塑从18改为15，幸运王冕从20改为15
            const requiredCount = skillId === 1 ? 9 : skillId === 2 ? 8 : skillId === 3 ? 9 : skillId === 4 ? 15 : 15;
            
            // 已消除水果数量的最大值设为触发技能所需水果数量的四倍
            const maxCount = requiredCount * 4;
            const displayCount = Math.min(gameState.skills[skillId].count, maxCount);
            
            // 进度条基于所需数量计算（最多显示100%）
            const progress = Math.min((gameState.skills[skillId].count / requiredCount) * 100, 100);
            progressFill.style.width = `${progress}%`;
            
            // 设置进度条颜色为对应水果色系
            const progressColors = {
                1: 'rgba(239, 68, 68, 0.8)', // 草莓红色（声东击西）
                2: 'rgba(59, 130, 246, 0.8)', // 蓝莓蓝色（中心爆破）
                3: 'rgba(249, 115, 22, 0.8)', // 橙子橙色（十字激光）
                4: 'rgba(139, 92, 246, 0.8)', // 葡萄紫色（全域重塑）
                5: 'rgba(34, 197, 94, 0.8)'  // 猕猴桃绿色（幸运王冕）
            };
            progressFill.style.backgroundColor = progressColors[skillId] || 'rgba(239, 68, 68, 0.8)';
            
            // 添加或更新计数：显示为"已消除数量/所需数量"
            let skillCountElement = progressBar.querySelector('.skill-count');
            if (!skillCountElement) {
                skillCountElement = document.createElement('div');
                skillCountElement.className = 'skill-count';
                progressBar.appendChild(skillCountElement);
            }
            skillCountElement.textContent = `${displayCount}/${requiredCount}`;
            
            // 添加或更新效果描述
            let skillEffectElement = progressBar.querySelector('.skill-effect');
            if (!skillEffectElement) {
                skillEffectElement = document.createElement('div');
                skillEffectElement.className = 'skill-effect';
                progressBar.appendChild(skillEffectElement);
            }
            skillEffectElement.textContent = skillEffect;
            
            // 添加技能按键标注
            let skillKeyElement = progressBar.querySelector('.skill-key');
            if (!skillKeyElement) {
                skillKeyElement = document.createElement('div');
                skillKeyElement.className = 'skill-key';
                progressBar.appendChild(skillKeyElement);
            }
            skillKeyElement.textContent = slotIndex === 0 ? '按键: 1' : '按键: 2';
            
            // 添加自动/手动触发切换按钮（仅前四个技能）
            if (skillId < 5) {
                let autoToggleElement = progressBar.querySelector('.auto-toggle');
                if (!autoToggleElement) {
                    autoToggleElement = document.createElement('button');
                    autoToggleElement.className = 'auto-toggle';
                    autoToggleElement.addEventListener('click', () => {
                    gameState.skills[skillId].auto = !gameState.skills[skillId].auto;
                    updateSkillProgress();
                    
                    // 如果切换为自动触发，检查是否已满足触发条件
                    if (gameState.skills[skillId].auto && !gameState.isAnimating && !gameState.skillInProgress) {
                        checkSkillTriggersAfterDrop();
                    }
                });
                    progressBar.appendChild(autoToggleElement);
                }
                autoToggleElement.textContent = gameState.skills[skillId].auto ? '自动触发: 开' : '自动触发: 关';
                if (gameState.skills[skillId].auto) {
                    autoToggleElement.classList.add('active');
                } else {
                    autoToggleElement.classList.remove('active');
                }
            }
            
            // 移除未携带提示
            const emptyText = progressBar.querySelector('.empty-slot-text');
            if (emptyText) {
                emptyText.remove();
            }
        } else {
            // 未携带技能，显示灰色图标和提示文字
            progressBar.classList.add('empty-slot');
            
            // 添加灰色图标
            let skillIcon = progressBar.querySelector('.skill-icon-display');
            if (!skillIcon) {
                skillIcon = document.createElement('div');
                skillIcon.className = 'skill-icon-display';
                progressBar.appendChild(skillIcon);
            }
            skillIcon.className = 'skill-icon-display empty';
            skillIcon.style.backgroundImage = '';
            
            // 添加未携带提示文字
            let emptyText = progressBar.querySelector('.empty-slot-text');
            if (!emptyText) {
                emptyText = document.createElement('div');
                emptyText.className = 'empty-slot-text';
                progressBar.appendChild(emptyText);
            }
            emptyText.textContent = '未携带该槽位技能';
            
            // 隐藏进度相关元素
            const progressContainer = progressBar.querySelector('.progress-container');
            if (progressContainer) {
                progressContainer.style.display = 'none';
            }
            const skillCountElement = progressBar.querySelector('.skill-count');
            if (skillCountElement) {
                skillCountElement.style.display = 'none';
            }
            const skillEffectElement = progressBar.querySelector('.skill-effect');
            if (skillEffectElement) {
                skillEffectElement.style.display = 'none';
            }
            const skillKeyElement = progressBar.querySelector('.skill-key');
            if (skillKeyElement) {
                skillKeyElement.style.display = 'none';
            }
            const autoToggleElement = progressBar.querySelector('.auto-toggle');
            if (autoToggleElement) {
                autoToggleElement.style.display = 'none';
            }
            const skillNameElement = progressBar.querySelector('.skill-name');
            if (skillNameElement) {
                skillNameElement.style.display = 'none';
            }
        }
    }
    
    // 隐藏多余的技能槽（如果有的话）
    for (let i = 3; i <= 5; i++) {
        const progressBar = document.querySelector(`.progress-bar[data-skill="${i}"]`);
        if (progressBar) {
            progressBar.style.display = 'none';
        }
    }
    
    // 更新被动技能槽（幸运王冕）
    updatePassiveSkillSlot();
}

// 更新被动技能槽显示
function updatePassiveSkillSlot() {
    const passiveSlot = document.getElementById('passiveSkillSlot');
    const progressFill = document.getElementById('passiveProgressFill');
    const progressText = document.getElementById('passiveProgressText');
    const toggleBtn = document.getElementById('passiveToggleBtn');
    const remainingCount = document.getElementById('luckyCrownRemaining');
    
    if (!passiveSlot || !progressFill || !progressText || !toggleBtn) return;
    
    const skill5 = gameState.skills[5];
    
    // 设置锁定/解锁状态
    if (skill5.unlocked) {
        passiveSlot.classList.remove('locked');
        toggleBtn.disabled = false;
        
        // 更新进度条
        const requiredCount = 15;
        const maxCount = requiredCount * 4;
        const displayCount = Math.min(skill5.count, maxCount);
        const progress = Math.min((skill5.count / requiredCount) * 100, 100);
        
        progressFill.style.width = `${progress}%`;
        progressText.textContent = `${displayCount}/${requiredCount}`;
        
        // 更新剩余加分次数
        if (remainingCount) {
            remainingCount.textContent = gameState.luckyCrownActive || 0;
        }
        
        // 更新开关按钮状态
        if (skill5.passive) {
            toggleBtn.classList.remove('inactive');
            toggleBtn.classList.add('active');
            toggleBtn.innerHTML = '<span class="toggle-text">开</span>';
        } else {
            toggleBtn.classList.remove('active');
            toggleBtn.classList.add('inactive');
            toggleBtn.innerHTML = '<span class="toggle-text">关</span>';
        }
    } else {
        passiveSlot.classList.add('locked');
        toggleBtn.disabled = true;
        progressFill.style.width = '0%';
        progressText.textContent = '未解锁';
        if (remainingCount) {
            remainingCount.textContent = 0;
        }
        toggleBtn.innerHTML = '<span class="toggle-text">关</span>';
    }
}

// 处理单元格点击
function handleCellClick(e) {
    if (gameState.isAnimating || gameState.skillInProgress) return;

    const cell = e.target;
    if (!cell.classList.contains('grid-cell')) return;
    
    // 空格子不能被选中
    if (cell.classList.contains('empty-cell')) return;
    
    const row = parseInt(cell.dataset.row);
    const col = parseInt(cell.dataset.col);
    
    if (!gameState.selectedCell) {
        selectCell(cell, row, col);
    } else {
        if (isAdjacent(gameState.selectedCell.row, gameState.selectedCell.col, row, col)) {
            swapCellsWithAnimation(gameState.selectedCell.row, gameState.selectedCell.col, row, col);
        } else {
            gameState.selectedCell = null;
            clearSelection();
            selectCell(cell, row, col);
        }
    }
}

// 选择单元格
function selectCell(cell, row, col) {
    clearSelection();
    cell.classList.add('selected');
    gameState.selectedCell = { row, col, element: cell };
    
    // 创建选中粒子环绕效果
    createSelectionParticles(cell);
}

// 清除选择
function clearSelection() {
    const selected = document.querySelector('.grid-cell.selected');
    if (selected) {
        selected.classList.remove('selected');
    }
    
    // 移除选中粒子效果
    document.querySelectorAll('.selection-particle').forEach(p => p.remove());
}

// 检查是否相邻
function isAdjacent(row1, col1, row2, col2) {
    const rowDiff = Math.abs(row1 - row2);
    const colDiff = Math.abs(col1 - col2);
    return (rowDiff === 1 && colDiff === 0) || (rowDiff === 0 && colDiff === 1);
}

// 交换单元格并添加动画
function swapCellsWithAnimation(row1, col1, row2, col2) {
    gameState.isAnimating = true;

    // 保存交换前的水果类型（用于高亮葡萄消除逻辑）
    const fruit1Before = gameState.gameGrid[row1][col1];
    const fruit2Before = gameState.gameGrid[row2][col2];

    const cell1 = document.querySelector(`[data-row="${row1}"][data-col="${col1}"]`);
    const cell2 = document.querySelector(`[data-row="${row2}"][data-col="${col2}"]`);

    if (cell1 && cell2) {
        // 计算交换距离
        const rect1 = cell1.getBoundingClientRect();
        const rect2 = cell2.getBoundingClientRect();
        const gridRect = elements.gameGrid.getBoundingClientRect();

        const x1 = rect1.left - gridRect.left;
        const y1 = rect1.top - gridRect.top;
        const x2 = rect2.left - gridRect.left;
        const y2 = rect2.top - gridRect.top;

        const swapX = x2 - x1;
        const swapY = y2 - y1;

        // 设置CSS变量
        cell1.style.setProperty('--swap-x', `${swapX}px`);
        cell1.style.setProperty('--swap-y', `${swapY}px`);
        cell2.style.setProperty('--swap-x', `${-swapX}px`);
        cell2.style.setProperty('--swap-y', `${-swapY}px`);

        // 添加交换动画
        cell1.classList.add('moving');
        cell2.classList.add('moving');

        setTimeout(() => {
            // 执行实际交换
            [gameState.gameGrid[row1][col1], gameState.gameGrid[row2][col2]] = [gameState.gameGrid[row2][col2], gameState.gameGrid[row1][col1]];
            
            // 更新高亮葡萄的位置（如果涉及高亮葡萄）
            // 检查是否有高亮葡萄参与了这次交换
            if (isHighlightedGrape(row1, col1)) {
                // 高亮葡萄从 (row1, col1) 移动到了 (row2, col2)
                removeHighlightedGrape(row1, col1);
                addHighlightedGrape(row2, col2);
            } else if (isHighlightedGrape(row2, col2)) {
                // 高亮葡萄从 (row2, col2) 移动到了 (row1, col1)
                removeHighlightedGrape(row2, col2);
                addHighlightedGrape(row1, col1);
            }
            
            renderGrid();

            // 立即检查匹配，传递交换前的水果类型
            const hasMatch = checkAndProcessMatches(row1, col1, row2, col2, fruit1Before, fruit2Before);

            if (!hasMatch) {
                // 没有匹配，回弹
                setTimeout(() => {
                    // 重新获取单元格（renderGrid会重新创建它们）
                    const newCell1 = document.querySelector(`[data-row="${row1}"][data-col="${col1}"]`);
                    const newCell2 = document.querySelector(`[data-row="${row2}"][data-col="${col2}"]`);

                    if (newCell1 && newCell2) {
                        // 重新设置回弹距离
                        newCell1.style.setProperty('--swap-x', `${-swapX}px`);
                        newCell1.style.setProperty('--swap-y', `${-swapY}px`);
                        newCell2.style.setProperty('--swap-x', `${swapX}px`);
                        newCell2.style.setProperty('--swap-y', `${swapY}px`);

                        newCell1.classList.add('swap-back');
                        newCell2.classList.add('swap-back');

                        setTimeout(() => {
                            // 回弹时恢复水果位置
                            [gameState.gameGrid[row1][col1], gameState.gameGrid[row2][col2]] = [gameState.gameGrid[row2][col2], gameState.gameGrid[row1][col1]];
                            
                            // 恢复高亮葡萄的位置（如果涉及高亮葡萄）
                            if (isHighlightedGrape(row2, col2)) {
                                // 高亮葡萄现在在 (row2, col2)，需要恢复到原来的 (row1, col1)
                                removeHighlightedGrape(row2, col2);
                                addHighlightedGrape(row1, col1);
                            } else if (isHighlightedGrape(row1, col1)) {
                                // 高亮葡萄现在在 (row1, col1)，需要恢复到原来的 (row2, col2)
                                removeHighlightedGrape(row1, col1);
                                addHighlightedGrape(row2, col2);
                            }
                            
                            renderGrid();
                            gameState.isAnimating = false;
                        }, 250);
                    } else {
                        gameState.isAnimating = false;
                    }
                }, 250);
            } else {
                // 有匹配，消耗步数（无尽模式不消耗步数）
                if (gameState.currentLevel <= 10) {
                    gameState.steps++;
                    updateGameInfo();
                    // 步数检查将在消除完成后进行（processAllMatchesSimultaneously中）
                }
            }

            gameState.selectedCell = null;
            clearSelection();
        }, 250);
    }
}

// 检查并处理匹配（分组版本）
// fruit1Before, fruit2Before: 交换前的水果类型（用于高亮葡萄消除逻辑）
function checkAndProcessMatches(row1, col1, row2, col2, fruit1Before = null, fruit2Before = null) {
    const matchGroups = findMatchGroups();

    // 检查是否移动了高亮葡萄
    const movedHighlightedGrape = (isHighlightedGrape(row1, col1) || isHighlightedGrape(row2, col2));
    
    if (movedHighlightedGrape) {
        // 处理高亮葡萄的消除逻辑，传递交换前的水果类型
        const success = processHighlightedGrapeMatch(row1, col1, row2, col2, fruit1Before, fruit2Before);
        // 如果高亮葡萄处理失败（被锁），继续检查普通匹配
        if (success) {
            return true;
        }
        // 处理失败，继续检查普通匹配
        if (matchGroups.length > 0) {
            processMatchGroupsSequentially(matchGroups);
            return true;
        }
        return false;
    }
    
    if (matchGroups.length > 0) {
        // 按组处理匹配
        processMatchGroupsSequentially(matchGroups);
        return true;
    }
    return false;
}

// 处理高亮葡萄的消除逻辑
function processHighlightedGrapeMatch(row1, col1, row2, col2, fruit1Before, fruit2Before) {
    // 检查是否正在处理中，防止并发执行
    if (gameState.isProcessingLocked) {
        console.log('检测到并发消除尝试，已忽略');
        // 重置状态，避免卡死
        setTimeout(() => {
            gameState.isAnimating = false;
            gameState.selectedCell = null;
            clearSelection();
        }, 100);
        return false; // 返回 false 表示处理失败
    }
    
    // 锁定消除处理
    gameState.isProcessingLocked = true;
    gameState.isAnimating = true;
    
    // 设置高亮葡萄触发标记 - 由高亮葡萄触发的消除不计入技能计数
    gameState.highlightedGrapeTriggered = true;
    
    // 清理之前可能残留的动画类
    clearAllAnimationClasses();
    
    // 确定高亮葡萄和被交换的水果的位置
    let grapeRow, grapeCol, targetRow, targetCol;
    let targetFruit; // 被交换水果的类型（交换前）
    
    // 检查高亮葡萄现在的位置（已经在swapCellsWithAnimation中更新过）
    if (isHighlightedGrape(row2, col2)) {
        // 高亮葡萄从 (row1, col1) 移动到了 (row2, col2)
        grapeRow = row2;
        grapeCol = col2;
        targetRow = row1;  // 被交换水果现在的位置（原来高亮葡萄的位置）
        targetCol = col1;
        // 使用目标位置交换前的水果类型
        targetFruit = fruit2Before;
    } else if (isHighlightedGrape(row1, col1)) {
        // 高亮葡萄从 (row2, col2) 移动到了 (row1, col1)
        grapeRow = row1;
        grapeCol = col1;
        targetRow = row2;  // 被交换水果现在的位置（原来高亮葡萄的位置）
        targetCol = col2;
        // 使用目标位置交换前的水果类型
        targetFruit = fruit1Before;
    } else {
        // 没有找到高亮葡萄，可能是处理延迟导致状态不一致
        console.log('警告：未找到高亮葡萄位置');
        gameState.isProcessingLocked = false;
        gameState.isAnimating = false;
        return false;
    }
    
    // 收集需要消除的水果：高亮葡萄 + 被交换水果 + 所有同类型水果
    const matches = [];
    
    // 添加高亮葡萄
    matches.push({ row: grapeRow, col: grapeCol });
    
    // 添加被交换的水果（如果不是高亮葡萄自己）
    if (!(targetRow === grapeRow && targetCol === grapeCol)) {
        matches.push({ row: targetRow, col: targetCol });
    }
    
    // 添加所有与被交换水果同类型的水果（使用交换前的类型）
    if (targetFruit) {
        for (let r = 0; r < GRID_SIZE; r++) {
            for (let c = 0; c < GRID_SIZE; c++) {
                if (gameState.gameGrid[r][c] === targetFruit && !(r === grapeRow && c === grapeCol)) {
                    matches.push({ row: r, col: c });
                }
            }
        }
    }
    
    // 显示预消除效果
    showPreEliminateEffect(matches, () => {
        // 播放消除动画（高亮葡萄触发，按50%计入技能计数）
        showPopAnimation(matches, null, true);
        
        setTimeout(() => {
            // 移除匹配的水果（允许消除高亮葡萄，因为这是玩家操作）
            removeMatches(matches, true);
            renderGrid();
            
            // 触发下落填充
            dropCellsWithAnimation(matches, () => {
                // 释放锁
                gameState.isProcessingLocked = false;
                gameState.isAnimating = false;
                // 重置高亮葡萄触发标记
                gameState.highlightedGrapeTriggered = false;
                checkSkillTriggersAfterDrop();
            });
        }, 350);
    });
    
    return true; // 返回 true 表示处理成功
}

// 查找所有匹配组（3-6个相邻水果为一组）
function findMatchGroups() {
    const matchGroups = [];
    const checkedHorizontal = new Set();
    const checkedVertical = new Set();

    for (let row = 0; row < GRID_SIZE; row++) {
        for (let col = 0; col < GRID_SIZE; col++) {
            // 检查横向匹配（3-6个）- 只从匹配组的起始位置检查
            const horizontalKey = `${row},${col}`;
            if (!checkedHorizontal.has(horizontalKey)) {
                const horizontalMatch = checkHorizontalMatch(row, col);
                
                if (horizontalMatch.length >= 3 && horizontalMatch.length <= 6) {
                    const group = {
                        cells: [...horizontalMatch],
                        type: 'horizontal',
                        fruit: gameState.gameGrid[row][col]
                    };
                    matchGroups.push(group);
                    // 标记这个匹配组的所有单元格已检查过横向
                    horizontalMatch.forEach(cell => checkedHorizontal.add(`${cell.row},${cell.col}`));
                }
            }

            // 检查纵向匹配（3-6个）- 只从匹配组的起始位置检查
            const verticalKey = `${row},${col}`;
            if (!checkedVertical.has(verticalKey)) {
                const verticalMatch = checkVerticalMatch(row, col);
                
                if (verticalMatch.length >= 3 && verticalMatch.length <= 6) {
                    const group = {
                        cells: [...verticalMatch],
                        type: 'vertical',
                        fruit: gameState.gameGrid[row][col]
                    };
                    matchGroups.push(group);
                    // 标记这个匹配组的所有单元格已检查过纵向
                    verticalMatch.forEach(cell => checkedVertical.add(`${cell.row},${cell.col}`));
                }
            }
        }
    }

    // 合并交叉的组（大组）
    const mergedGroups = mergeIntersectingGroups(matchGroups);

    return mergedGroups;
}

// 合并相交的组（横向和纵向交叉的水果组成大组）
function mergeIntersectingGroups(groups) {
    const result = [];
    const used = new Set();

    for (let i = 0; i < groups.length; i++) {
        if (used.has(i)) continue;

        const currentGroup = { ...groups[i], cells: [...groups[i].cells] };
        let merged = true;

        while (merged) {
            merged = false;

            for (let j = i + 1; j < groups.length; j++) {
                if (used.has(j)) continue;

                const otherGroup = groups[j];

                // 检查两组是否有交集
                const intersection = currentGroup.cells.filter(cell1 =>
                    otherGroup.cells.some(cell2 => cell1.row === cell2.row && cell1.col === cell2.col)
                );

                if (intersection.length > 0) {
                    // 合并两组（去重）
                    const existingCells = new Set(currentGroup.cells.map(c => `${c.row},${c.col}`));
                    otherGroup.cells.forEach(cell => {
                        if (!existingCells.has(`${cell.row},${cell.col}`)) {
                            currentGroup.cells.push(cell);
                            existingCells.add(`${cell.row},${cell.col}`);
                        }
                    });
                    // 保留原始方向，如果两组方向不同则保持第一个组的方向
                    // 因为线性消除需要知道原始方向来决定反方向
                    used.add(j);
                    merged = true;
                }
            }
        }

        result.push(currentGroup);
        used.add(i);
    }

    return result;
}

// 检查步数是否用完并设置游戏结束标记
function checkStepsAndSetGameOver() {
    // 只在非无尽模式下检查步数
    if (gameState.currentLevel <= 10 && !gameState.pendingGameOver) {
        if (gameState.steps >= LEVELS[gameState.currentLevel - 1].steps) {
            // 步数用完，检查是否达到所有完成条件
            if (checkLevelComplete()) {
                completeLevel();
            } else {
                // 未达到目标，设置等待标记，等动画完成后再显示游戏结束弹窗
                gameState.pendingGameOver = true;
                const levelConfig = LEVELS[gameState.currentLevel - 1];
                let msg = '步数用完，未达到目标！';
                if (gameState.score < levelConfig.goal) {
                    msg = `步数用完，分数未达到 ${levelConfig.goal} 分！`;
                } else if (levelConfig.skillRequirement) {
                    msg = `步数用完，${levelConfig.description}！`;
                }
                gameState.gameOverMessage = msg;
            }
        }
    }
}

// 检查并显示游戏结束弹窗（步数耗尽后等待动画完成）
function checkAndShowGameOver() {
    if (gameState.pendingGameOver && !gameState.isAnimating) {
        gameState.pendingGameOver = false;
        // 在显示失败弹窗前，再次检查是否已达到胜利条件
        if (checkLevelComplete()) {
            completeLevel();
        } else {
            elements.gameOverTitle.textContent = '游戏结束';
            elements.gameOverMessage.textContent = gameState.gameOverMessage || '步数用完，未达到目标！';
            elements.gameOverModal.classList.remove('hidden');
        }
    }
}

// 同步处理所有匹配组
// 线性消除常量
const LINEAR_ELIMINATION_SCORE = 15; // 线性消除固定获得15分

// 查找所有五消及以上的匹配组
function findFiveOrMoreMatches(matchGroups) {
    // 只检测单一方向上连续的 5 个水果（真正的五消）
    const fiveMatches = matchGroups.filter(group => {
        // 必须是横向或纵向的连续匹配
        if (group.type !== 'horizontal' && group.type !== 'vertical') {
            return false;
        }
        // 必须是连续的 5 个或以上水果
        if (group.cells.length < 5) {
            return false;
        }
        
        // 检查是否真的是连续的五消（不是纵横交错的混合组）
        if (group.type === 'horizontal') {
            // 横向五消：所有水果必须在同一行，且列是连续的
            const rows = [...new Set(group.cells.map(c => c.row))];
            if (rows.length !== 1) return false; // 不在同一行，不是真正的横向五消
            
            // 检查列是否连续
            const cols = group.cells.map(c => c.col).sort((a, b) => a - b);
            for (let i = 1; i < cols.length; i++) {
                if (cols[i] - cols[i - 1] !== 1) return false; // 列不连续
            }
        } else if (group.type === 'vertical') {
            // 纵向五消：所有水果必须在同一列，且行是连续的
            const cols = [...new Set(group.cells.map(c => c.col))];
            if (cols.length !== 1) return false; // 不在同一列，不是真正的纵向五消
            
            // 检查行是否连续
            const rows = group.cells.map(c => c.row).sort((a, b) => a - b);
            for (let i = 1; i < rows.length; i++) {
                if (rows[i] - rows[i - 1] !== 1) return false; // 行不连续
            }
        }
        
        return true;
    });
    console.log(`findFiveOrMoreMatches: 总匹配组=${matchGroups.length}, 五消组=${fiveMatches.length}`);
    return fiveMatches;
}

// 执行线性消除
function executeLinearElimination(fiveMatchGroups, callback) {
    console.log(`executeLinearElimination: 五消组数量=${fiveMatchGroups.length}`);
    
    if (fiveMatchGroups.length === 0) {
        // 没有五消组，直接执行回调
        console.log('没有五消组，直接执行回调');
        callback();
        return;
    }
    
    gameState.linearEliminationInProgress = true;
    console.log('开始执行线性消除');
    fiveMatchGroups.forEach((g, i) => {
        console.log(`五消组${i}: type=${g.type}, cells=${g.cells.length}, fruit=${g.fruit}`);
    });
    
    let completedCount = 0;
    
    fiveMatchGroups.forEach((group, groupIndex) => {
        setTimeout(() => {
            console.log(`线性消除组${groupIndex}开始执行, type=${group.type}, cells数量=${group.cells.length}`);
            // 在该水果组里随机选一个水果为中心
            const centerIndex = Math.floor(Math.random() * group.cells.length);
            const centerCell = group.cells[centerIndex];
            const isVertical = group.type === 'vertical';
            console.log(`选择中心单元格: (${centerCell.row}, ${centerCell.col}), isVertical=${isVertical}`);
            
            // 收集线性消除的目标单元格
            const linearCells = [];
            const linearCellSet = new Set();
            
            if (isVertical) {
                // 五消为纵向，线性消除为横向
                for (let col = 0; col < GRID_SIZE; col++) {
                    const key = `${centerCell.row},${col}`;
                    if (!linearCellSet.has(key)) {
                        linearCellSet.add(key);
                        linearCells.push({ row: centerCell.row, col });
                    }
                }
            } else {
                // 五消为横向，线性消除为纵向
                for (let row = 0; row < GRID_SIZE; row++) {
                    const key = `${row},${centerCell.col}`;
                    if (!linearCellSet.has(key)) {
                        linearCellSet.add(key);
                        linearCells.push({ row, col: centerCell.col });
                    }
                }
            }
            
            // 检查这些位置是否有水果（边界检查）
            const validLinearCells = linearCells.filter(cell => {
                return cell.row >= 0 && cell.row < GRID_SIZE && 
                       cell.col >= 0 && cell.col < GRID_SIZE &&
                       gameState.gameGrid[cell.row] && 
                       gameState.gameGrid[cell.row][cell.col] !== null;
            });
            
            if (validLinearCells.length === 0) {
                completedCount++;
                if (completedCount === fiveMatchGroups.length) {
                    gameState.linearEliminationInProgress = false;
                    callback();
                }
                return;
            }
            
            // 计算分数 - 线性消除固定获得15分
            gameState.score += LINEAR_ELIMINATION_SCORE;
            updateGameInfo();
            
            // 先显示预消除特效
            showPreEliminateEffect(validLinearCells, () => {
                // 预消除特效完成后，显示线性消除动画
                showLinearEliminationEffect(validLinearCells, () => {
                    // 移除线性消除的水果
                    validLinearCells.forEach(cell => {
                        const gridCell = document.querySelector(`[data-row="${cell.row}"][data-col="${cell.col}"]`);
                        if (gridCell) {
                            gridCell.remove();
                        }
                        // 从游戏网格中移除
                        if (gameState.gameGrid[cell.row]) {
                            gameState.gameGrid[cell.row][cell.col] = null;
                        }
                    });
                    
                    // 执行下落填充
                    dropCellsWithAnimation(validLinearCells, () => {
                        completedCount++;
                        console.log(`线性消除组${groupIndex}完成, completedCount=${completedCount}, total=${fiveMatchGroups.length}`);
                        if (completedCount === fiveMatchGroups.length) {
                            gameState.linearEliminationInProgress = false;
                            console.log('所有线性消除完成，执行回调');
                            callback();
                        }
                    }, { playLanding: false, isPlayerAction: false });
                });
            });
        }, groupIndex * 400); // 每个五消组间隔400ms执行
    });
}

// 显示线性消除效果
function showLinearEliminationEffect(cells, callback) {
    // 为线性消除的单元格添加特殊动画类，并创建粒子特效
    cells.forEach(cell => {
        const gridCell = document.querySelector(`[data-row="${cell.row}"][data-col="${cell.col}"]`);
        if (gridCell) {
            gridCell.classList.add('linear-eliminate');
            
            // 创建粒子爆炸特效（与普通消除相同的粒子效果）
            const fruit = gameState.gameGrid[cell.row][cell.col];
            if (fruit) {
                createParticleExplosion(gridCell, fruit, false, 1, false);
            }
        }
    });
    
    // 等待动画完成后回调
    setTimeout(() => {
        // 移除动画类
        cells.forEach(cell => {
            const gridCell = document.querySelector(`[data-row="${cell.row}"][data-col="${cell.col}"]`);
            if (gridCell) {
                gridCell.classList.remove('linear-eliminate');
            }
        });
        callback();
    }, 350);
}

// 参数：
//   skipPreEliminate: 是否跳过预消除效果
//   isPlayerAction: 是否为玩家主动操作（决定是否播放落地动画）
function processAllMatchesSimultaneously(skipPreEliminate = false, isPlayerAction = false) {
    // 检查是否正在处理中，防止并发执行
    if (gameState.isProcessingLocked || gameState.isAnimationLocked) {
        console.log('检测到并发消除尝试，已忽略');
        return;
    }
    
    // 锁定消除处理和动画流程
    gameState.isProcessingLocked = true;
    gameState.isAnimationLocked = true;
    
    // 标记进入一轮消除
    gameState.inRound = true;
    
    // 清理之前可能残留的动画类，防止重复播放
    clearAllAnimationClasses();
    
    // 查找所有匹配组
    const matchGroups = findMatchGroups();
    
    if (matchGroups.length === 0) {
        // 如果没有新匹配，为最后下落的水果补回落地动画
        setTimeout(() => {
            if (gameState.pendingLandingCells.length > 0) {
                playLandingAnimation(gameState.pendingLandingCells);
            }
        }, 100);
        gameState.isAnimating = false;
        gameState.isProcessingLocked = false; // 释放锁
        gameState.isAnimationLocked = false; // 释放动画锁
        gameState.inRound = false; // 标记一轮结束
        
        // 检查步数是否用完（消除完成后再检查）
        checkStepsAndSetGameOver();
        
        checkAndShowGameOver(); // 检查是否需要显示游戏结束弹窗
        return;
    }
    
    // 将所有组的cells合并为一个集合（去重）
    const allMatchCells = [];
    const cellSet = new Set();
    
    matchGroups.forEach(group => {
        group.cells.forEach(cell => {
            const key = `${cell.row},${cell.col}`;
            if (!cellSet.has(key)) {
                cellSet.add(key);
                allMatchCells.push(cell);
            }
        });
    });
    
    // 计算总消除数量，决定是否显示粒子效果
    const totalMatchCount = allMatchCells.length;
    
    // 处理所有匹配组的分数和技能计数
    processAllMatchScores(matchGroups);
    
    // 根据消除数量决定粒子效果
    // - 消除数量 <= 21：显示粒子效果
    // - 消除数量 > 21：不显示粒子效果（性能优化）
    const shouldShowParticles = totalMatchCount <= 21;
    
    // 显示预消除效果，然后执行消除动画
    showPreEliminateEffect(allMatchCells, () => {
        // 播放消除动画（同步播放所有消除）
        showPopAnimation(allMatchCells, null, !shouldShowParticles);
        
        // 等待消除动画完成（动画时长为0.35s）
        setTimeout(() => {
            // 移除所有匹配的水果
            removeMatches(allMatchCells);
            
            // 先移除带有popping类的单元格，避免renderGrid删除它们
            allMatchCells.forEach(match => {
                const cell = document.querySelector(`[data-row="${match.row}"][data-col="${match.col}"]`);
                if (cell) {
                    cell.remove();
                }
            });
            
            // 执行下落填充
            // 玩家操作：播放完整的下落+落地动画
            // 自动消除：仅播放下落动画，跳过落地动画以实现无缝衔接
            const dropOptions = {
                playLanding: isPlayerAction || gameState.comboCount === 0,
                isPlayerAction: isPlayerAction
            };
            
            dropCellsWithAnimation(allMatchCells, () => {
                // 回调已经在落地动画完成后触发
                
                // 标记本轮消除结束
                gameState.inRound = false;
                
                // 如果有全域重塑冷却，减少冷却轮数
                if (gameState.skill4CooldownRounds > 0) {
                    gameState.skill4CooldownRounds--;
                    console.log(`全域重塑冷却剩余: ${gameState.skill4CooldownRounds} 轮`);
                }
                
                // 查找五消及以上的匹配组（用于线性消除）
                const fiveMatchGroups = findFiveOrMoreMatches(matchGroups);
                
                // 执行线性消除（优先级：手动消除 > 线性消除 > 技能消除）
                executeLinearElimination(fiveMatchGroups, () => {
                    // 线性消除完成后，检查技能触发
                    checkSkillTriggersWithPriorityAfterDrop(() => {
                        // 技能处理完成后，释放所有锁
                        gameState.isProcessingLocked = false;
                        gameState.isAnimationLocked = false;
                        
                        gameState.comboCount++;
                        if (gameState.comboCount <= 10) {
                            // 自动消除阶段，跳过预消除效果以提高性能
                            processAllMatchesSimultaneously(true, false);
                        } else {
                            gameState.comboCount = 0;
                            gameState.isAnimating = false;
                            // 检查步数是否用完（消除完成后再检查）
                            checkStepsAndSetGameOver();
                            checkAndShowGameOver(); // 检查是否需要显示游戏结束弹窗
                        }
                    });
                });
            }, dropOptions);
        }, 350);
    }, skipPreEliminate);
}

// 处理所有匹配组的分数
function processAllMatchScores(groups) {
    let totalScore = 0;
    
    groups.forEach(group => {
        const matchCount = group.cells.length;
        let baseScore = matchCount;
        let bonusScore = 0;
        
        if (matchCount === 4) {
            bonusScore = 1;
        } else if (matchCount === 5) {
            bonusScore = 2;
        } else if (matchCount === 6) {
            bonusScore = 4;
        }
        
        totalScore += baseScore + bonusScore;
    });
    
    // 幸运王冕效果 - 后续5次消除每次额外获得12分（被动技能，无需携带）
    if (gameState.luckyCrownActive > 0 && gameState.skills[5].unlocked && gameState.skills[5].passive) {
        totalScore += 12 * groups.length;
        const wasActive = gameState.luckyCrownActive > 0;
        gameState.luckyCrownActive -= groups.length;
        if (gameState.luckyCrownActive < 0) gameState.luckyCrownActive = 0;
        updatePassiveSkillSlot(); // 更新剩余加分次数显示
        
        // 如果效果刚刚结束，停止粒子效果
        if (wasActive && gameState.luckyCrownActive === 0) {
            stopCrownParticleEffect();
        }
    }
    
    gameState.score += totalScore;
    updateGameInfo();
}

// 按顺序处理匹配组（每组独立计分）
function processMatchGroupsSequentially(groups) {
    // 重置combo计数，表示这是新的一轮消除（玩家操作）
    gameState.comboCount = 0;
    // 使用同步处理，标记为玩家操作以播放完整动画
    processAllMatchesSimultaneously(false, true);
}

// 处理单组匹配并计算分数
function processGroupWithScore(group, callback) {
    const matchCount = group.cells.length;

    // 计算分数
    let baseScore = matchCount;
    let bonusScore = 0;

    if (matchCount === 4) {
        bonusScore = 1;
    } else if (matchCount === 5) {
        bonusScore = 2;
    } else if (matchCount === 6) {
        bonusScore = 4;
    }

    let totalScore = baseScore + bonusScore;

    // 幸运王冕效果 - 后续5次消除每次额外获得12分（被动技能，无需携带）
    if (gameState.luckyCrownActive > 0 && gameState.skills[5].unlocked && gameState.skills[5].passive) {
        totalScore += 12;
        const wasActive = gameState.luckyCrownActive > 0;
        gameState.luckyCrownActive--;
        updatePassiveSkillSlot(); // 更新剩余加分次数显示
        
        // 如果效果刚刚结束，停止粒子效果
        if (wasActive && gameState.luckyCrownActive === 0) {
            stopCrownParticleEffect();
        }
    }

    gameState.score += totalScore;
    updateGameInfo();

    // 播放消除动画（手动触发，传入null）
    showPopAnimation(group.cells, null);

    setTimeout(() => {
        removeMatches(group.cells);
        renderGrid();
        callback();
    }, 350);
}

// 下落填充后检查下一组
function dropCellsAndCheckNext(currentGroup, remainingGroups) {
    const matches = currentGroup.cells;

    dropCellsWithAnimation(matches, () => {
        checkSkillTriggersWithPriority(remainingGroups);
    });
}

// 检查技能触发（带优先级控制）
function checkSkillTriggersWithPriority(remainingGroups) {
    let skillTriggered = false;

    if (remainingGroups.length > 0) {
        gameState.pendingRemainingGroups = [...remainingGroups];
    }

    gameState.selectedSkills.forEach(skillId => {
        if (skillId < 5 && gameState.skills[skillId].count >= (skillId === 1 ? 9 : skillId === 2 ? 8 : skillId === 3 ? 9 : 15) && gameState.skills[skillId].unlocked) {
            console.log(`技能${skillId}已就绪！`);

            if (gameState.skills[skillId].auto) {
                skillTriggered = true;
                gameState.skillInProgress = true;
                switch (skillId) {
                    case 1:
                        useSkill1();
                        break;
                    case 2:
                        useSkill2();
                        break;
                    case 3:
                        useSkill3();
                        break;
                    case 4:
                        useSkill4();
                        break;
                }
            }
        }
    });

    if (!skillTriggered) {
        if (remainingGroups.length > 0) {
            processMatchGroupsSequentially(remainingGroups);
        } else {
            gameState.comboCount++;
            if (gameState.comboCount <= 10) {
                const newGroups = findMatchGroups();
                if (newGroups.length > 0) {
                    processMatchGroupsSequentially(newGroups);
                } else {
                    gameState.comboCount = 0;
                    gameState.isAnimating = false;
                    checkAndShowGameOver(); // 检查是否需要显示游戏结束弹窗
                }
            } else {
                gameState.comboCount = 0;
                gameState.isAnimating = false;
                checkAndShowGameOver(); // 检查是否需要显示游戏结束弹窗
            }
        }
    }
}

// 检查是否为高亮葡萄
function isHighlightedGrape(row, col) {
    return gameState.highlightedGrapes.some(grape => grape.row === row && grape.col === col);
}

// 添加高亮葡萄
function addHighlightedGrape(row, col) {
    // 高亮葡萄最多同时存在2个
    if (gameState.highlightedGrapes.length >= 2) {
        console.log('高亮葡萄已达上限(2个)，无法添加新的高亮葡萄');
        return false; // 添加失败
    }
    
    // 检查是否已存在
    if (!isHighlightedGrape(row, col)) {
        gameState.highlightedGrapes.push({ row, col });
        console.log(`高亮葡萄已添加: (${row}, ${col})，当前数量: ${gameState.highlightedGrapes.length}`);
        return true; // 添加成功
    }
    return false; // 已存在，无需添加
}

// 移除高亮葡萄
function removeHighlightedGrape(row, col) {
    gameState.highlightedGrapes = gameState.highlightedGrapes.filter(grape => !(grape.row === row && grape.col === col));
}

// 清空所有高亮葡萄
function clearHighlightedGrapes() {
    gameState.highlightedGrapes = [];
}

// 检查水平匹配
function checkHorizontalMatch(row, col) {
    const fruit = gameState.gameGrid[row][col];
    const match = [{ row, col }];
    
    // 如果是高亮葡萄，它不参与任何匹配
    if (isHighlightedGrape(row, col)) {
        return match;
    }
    
    for (let i = col + 1; i < GRID_SIZE; i++) {
        const currentFruit = gameState.gameGrid[row][i];
        
        // 如果遇到高亮葡萄，停止匹配
        if (isHighlightedGrape(row, i)) {
            break;
        }
        
        if (currentFruit === fruit) {
            match.push({ row, col: i });
        } else {
            break;
        }
    }
    
    return match;
}

// 检查垂直匹配
function checkVerticalMatch(row, col) {
    const fruit = gameState.gameGrid[row][col];
    const match = [{ row, col }];
    
    // 如果是高亮葡萄，它不参与任何匹配
    if (isHighlightedGrape(row, col)) {
        return match;
    }
    
    for (let i = row + 1; i < GRID_SIZE; i++) {
        const currentFruit = gameState.gameGrid[i][col];
        
        // 如果遇到高亮葡萄，停止匹配
        if (isHighlightedGrape(i, col)) {
            break;
        }
        
        if (currentFruit === fruit) {
            match.push({ row: i, col });
        } else {
            break;
        }
    }
    
    return match;
}

// 处理匹配
function processMatches(matches) {
    // 使用同步处理机制
    processAllMatchesSimultaneously();
}

// 水果颜色配置
const FRUIT_COLORS = {
    'strawberry': { primary: 'rgba(255, 107, 107, 0.9)', secondary: 'rgba(255, 150, 150, 0.7)', glow: 'rgba(255, 107, 107, 0.5)' },
    'blueberries': { primary: 'rgba(100, 149, 237, 0.9)', secondary: 'rgba(135, 206, 235, 0.7)', glow: 'rgba(100, 149, 237, 0.5)' },
    'orange': { primary: 'rgba(255, 159, 67, 0.9)', secondary: 'rgba(255, 190, 120, 0.7)', glow: 'rgba(255, 159, 67, 0.5)' },
    'grape': { primary: 'rgba(95, 39, 205, 0.9)', secondary: 'rgba(130, 80, 230, 0.7)', glow: 'rgba(95, 39, 205, 0.5)' },
    'kiwi': { primary: 'rgba(29, 209, 161, 0.9)', secondary: 'rgba(80, 220, 180, 0.7)', glow: 'rgba(29, 209, 161, 0.5)' }
};

// 创建选中粒子环绕效果
function createSelectionParticles(cell) {
    const rect = cell.getBoundingClientRect();
    const gridRect = elements.gameGrid.getBoundingClientRect();
    const x = rect.left - gridRect.left + rect.width / 2;
    const y = rect.top - gridRect.top + rect.height / 2;
    const particleCount = 8;

    for (let i = 0; i < particleCount; i++) {
        const particle = document.createElement('div');
        particle.className = 'selection-particle';

        const angle = (i / particleCount) * Math.PI * 2;
        const radius = 35;
        const px = x + Math.cos(angle) * radius;
        const py = y + Math.sin(angle) * radius;
        const size = 4 + Math.random() * 4;

        particle.style.cssText = `
            width: ${size}px;
            height: ${size}px;
            left: ${px}px;
            top: ${py}px;
            animation-delay: ${i * 0.15}s;
        `;

        elements.particlesLayer.appendChild(particle);
    }
}

// 显示预消除效果
// skipPreEliminate: 是否跳过预消除效果（用于全域重塑等特殊技能）
function showPreEliminateEffect(matches, callback, skipPreEliminate = false) {
    if (skipPreEliminate || matches.length === 0) {
        if (callback) callback();
        return;
    }

    // 添加预消除样式
    matches.forEach(match => {
        const cell = document.querySelector(`[data-row="${match.row}"][data-col="${match.col}"]`);
        if (cell) {
            cell.classList.add('pre-eliminate');
        }
    });

    // 预消除效果持续0.18秒后执行回调
    setTimeout(() => {
        // 移除预消除样式
        matches.forEach(match => {
            const cell = document.querySelector(`[data-row="${match.row}"][data-col="${match.col}"]`);
            if (cell) {
                cell.classList.remove('pre-eliminate');
            }
        });

        if (callback) callback();
    }, 180);
}
// 创建粒子爆炸效果
function createParticleExplosion(cell, fruit, reducedMode = false, reduceRatio = 1, skipSparkles = false) {
    const rect = cell.getBoundingClientRect();
    const gridRect = elements.gameGrid.getBoundingClientRect();
    const x = rect.left - gridRect.left + rect.width / 2;
    const y = rect.top - gridRect.top + rect.height / 2;

    const colors = FRUIT_COLORS[fruit] || FRUIT_COLORS['strawberry'];
    
    // 减少粒子数量，保留爆炸效果
    // 正常模式：减少约30%的粒子
    // 简化模式（大量消除时）：再减少50%
    const normalParticleCount = 14; // 从20减少到14
    const reducedParticleCount = 8; // 简化模式进一步减少
    
    // 根据减少比例计算最终粒子数量
    let particleCount = reducedMode ? reducedParticleCount : normalParticleCount;
    particleCount = Math.ceil(particleCount * reduceRatio);
    particleCount = Math.max(particleCount, 3); // 最少保留3个粒子

    // 创建主粒子（向外爆炸效果）
    for (let i = 0; i < particleCount; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle';

        const angle = (i / particleCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
        const velocity = 35 + Math.random() * 45;
        const tx = Math.cos(angle) * velocity;
        const ty = Math.sin(angle) * velocity + 15; // 添加向下的重力偏移
        const size = 4 + Math.random() * 7;
        const gravity = Math.random() * 15; // 随机重力效果

        particle.style.cssText = `
            width: ${size}px;
            height: ${size}px;
            left: ${x}px;
            top: ${y}px;
            background: radial-gradient(circle, ${colors.primary} 0%, ${colors.secondary} 50%, transparent 100%);
            box-shadow: 0 0 ${size * 2}px ${colors.glow};
            --tx: ${tx}px;
            --ty: ${ty}px;
            --gravity: ${gravity}px;
        `;

        elements.particlesLayer.appendChild(particle);

        setTimeout(() => particle.remove(), 400);
    }

    // 创建小型碎片粒子（更快扩散）- 减少30%数量
    // 第二部分：扩散、变大的小颗粒粒子特效
    const normalSmallCount = 6; // 从8减少30%到6
    const reducedSmallCount = 3; // 简化模式进一步减少（从4减少30%到3）
    const smallCount = reducedMode ? reducedSmallCount : normalSmallCount;
    
    for (let i = 0; i < smallCount; i++) {
        const smallParticle = document.createElement('div');
        smallParticle.className = 'particle small';

        const angle = Math.random() * Math.PI * 2;
        const velocity = 25 + Math.random() * 35;
        const tx = Math.cos(angle) * velocity;
        const ty = Math.sin(angle) * velocity;
        const size = 2 + Math.random() * 3;

        smallParticle.style.cssText = `
            width: ${size}px;
            height: ${size}px;
            left: ${x}px;
            top: ${y}px;
            background: radial-gradient(circle, ${colors.secondary} 0%, transparent 70%);
            --tx: ${tx}px;
            --ty: ${ty}px;
        `;

        elements.particlesLayer.appendChild(smallParticle);
        setTimeout(() => smallParticle.remove(), 400);
    }

    // 添加闪耀粒子 - 减少30%数量
    // 第二部分：扩散、变大的小颗粒粒子特效
    if (!skipSparkles) {
        const normalSparkleCount = 4; // 从5减少30%到4
        const reducedSparkleCount = 2; // 简化模式进一步减少（从2保持不变，已是最小）
        const sparkleCount = reducedMode ? reducedSparkleCount : normalSparkleCount;
        
        for (let i = 0; i < sparkleCount; i++) {
            const sparkle = document.createElement('div');
            sparkle.className = 'sparkle';

            const angle = Math.random() * Math.PI * 2;
            const distance = 20 + Math.random() * 35;
            const sx = x + Math.cos(angle) * distance;
            const sy = y + Math.sin(angle) * distance;

            sparkle.style.cssText = `
                left: ${sx}px;
                top: ${sy}px;
                animation-delay: ${i * 0.02}s;
                background: radial-gradient(circle, rgba(255,255,255,1) 0%, ${colors.primary} 40%, transparent 70%);
            `;

            elements.particlesLayer.appendChild(sparkle);
            setTimeout(() => sparkle.remove(), 450 + i * 20);
        }
    }

    // 添加涟漪效果
    const ripple = document.createElement('div');
    ripple.className = 'ripple-effect';
    ripple.style.cssText = `
        left: ${x - 25}px;
        top: ${y - 25}px;
        width: 50px;
        height: 50px;
        border-color: ${colors.primary};
        box-shadow: 0 0 20px ${colors.glow};
    `;

    elements.particlesLayer.appendChild(ripple);
    setTimeout(() => ripple.remove(), 400);
}

// 显示消除动画
// skillSource: null表示手动消除, 1-4表示技能触发(按50%计算), 0表示全域重塑（不计入）
// skipParticles: 是否跳过粒子效果（用于大量水果同时消除的情况）
// countMultiplier: 计入比例
// isCrossLaser: 是否为十字激光（用于特殊粒子效果处理）
function showPopAnimation(matches, skillSource = null, skipParticles = false, countMultiplier = null, isCrossLaser = false) {
    // 统计每种水果数量
    const fruitCounts = {};
    matches.forEach(match => {
        const fruit = gameState.gameGrid[match.row][match.col];
        fruitCounts[fruit] = (fruitCounts[fruit] || 0) + 1;
    });

    // 根据消除数量决定粒子效果：
    // - 消除数量 <= 14：显示正常粒子效果
    // - 消除数量 >= 15：减少60%粒子效果（用户要求）
    // - 十字激光消除：减少20%粒子效果
    const totalCount = matches.length;
    const shouldShowParticles = totalCount <= 21;
    const shouldSkipParticles = skipParticles || (totalCount > 21);
    
    // 粒子减少模式
    let reduceParticles = false;
    let reduceRatio = 1; // 1表示正常，0.8表示减少20%，0.4表示减少60%
    
    if (isCrossLaser) {
        // 十字激光减少35%粒子，删除闪耀粒子
        reduceRatio = 0.65; // 减少35% = 保留65%
        reduceParticles = true;
    } else if (totalCount >= 15) {
        // 大量消除减少60%（用户要求）
        reduceRatio = 0.4;
        reduceParticles = true;
    } else if (totalCount > 21) {
        // 超大量消除使用简化模式
        reduceParticles = true;
    }

    matches.forEach(match => {
        const cell = document.querySelector(`[data-row="${match.row}"][data-col="${match.col}"]`);
        if (cell) {
            const fruit = gameState.gameGrid[match.row][match.col];
            if (!shouldSkipParticles && shouldShowParticles) {
                // 根据情况使用不同的粒子模式
                // 十字激光时跳过闪耀粒子
                createParticleExplosion(cell, fruit, reduceParticles, reduceRatio, isCrossLaser);
            }
            cell.classList.add('popping');
        }
    });

    // 根据技能来源计算技能计数
    // 全域重塑(0)不计入任何技能计数
    if (skillSource !== 0) {
        // 计算计入比例
        // 高亮葡萄触发的消除按50%计入，向下取整
        // 技能触发时按50%计入，普通消除按100%计入
        let multiplier;
        if (countMultiplier !== null) {
            multiplier = countMultiplier;
        } else if (gameState.highlightedGrapeTriggered) {
            multiplier = 0.5;
        } else if (skillSource !== null) {
            multiplier = 0.5;
        } else {
            multiplier = 1;
        }

        Object.keys(fruitCounts).forEach(fruit => {
            // 根据计入比例计算应该计入的数量，向下取整
            let addCount = Math.floor(fruitCounts[fruit] * multiplier);

            if (addCount === 0) return;

            // 高亮葡萄消除普通葡萄不计入全域重塑的计数
            if (gameState.highlightedGrapeTriggered && fruit === 'grape') {
                return;
            }

            switch (fruit) {
                case 'strawberry':
                    gameState.skills[1].count = Math.min(gameState.skills[1].count + addCount, gameState.skills[1].max);
                    break;
                case 'blueberries':
                    gameState.skills[2].count = Math.min(gameState.skills[2].count + addCount, gameState.skills[2].max);
                    break;
                case 'orange':
                    // 十字激光消除的橙子按50%计入（已在multiplier中处理）
                    // 其他情况按正常比例计入
                    gameState.skills[3].count = Math.min(gameState.skills[3].count + addCount, gameState.skills[3].max);
                    break;
                case 'grape':
                    // 只有在全域重塑冷却结束后才累计葡萄
                    // 触发技能后冷却3轮，第4轮开始才能累计
                    if (gameState.skill4CooldownRounds === 0) {
                        gameState.skills[4].count = Math.min(gameState.skills[4].count + addCount, gameState.skills[4].max);
                    }
                    break;
                case 'kiwi':
                    gameState.skills[5].count = Math.min(gameState.skills[5].count + addCount, gameState.skills[5].max);
                    break;
            }
        });
    }

    updateSkillProgress();

    // 检查技能触发（仅当手动消除时检查，防止循环触发）
    if (skillSource === null) {
        checkSkillTriggers();
    }
}

// 检查技能触发
function checkSkillTriggers() {
    // 如果正在执行技能，跳过检查
    if (gameState.skillInProgress) {
        return;
    }
    
    // 检查技能1-4的触发条件（将满足条件的技能添加到待触发队列）
    gameState.selectedSkills.forEach(skillId => {
        // 获取技能触发所需的水果数量
        // 技能4（全域重塑）需要15个葡萄，技能5（幸运王冕）需要15个水果
        const requiredCount = skillId === 1 ? 9 : skillId === 2 ? 8 : skillId === 3 ? 9 : 15;
        
        // 检查是否满足触发条件（数量足够且技能已解锁）
        // 技能4（全域重塑）需要额外检查冷却状态
        // 十字激光（技能3）需要额外检查是否被锁定
        const canTrigger = skillId < 5 && 
                          gameState.skills[skillId].count >= requiredCount && 
                          gameState.skills[skillId].unlocked &&
                          (skillId !== 4 || gameState.skill4CooldownRounds === 0) &&
                          (skillId !== 3 || !gameState.crossLaserLocked);
        
        if (canTrigger && gameState.skills[skillId].auto) {
            // 检查该技能是否已在待触发队列中
            const alreadyPending = gameState.pendingSkillTriggers.some(p => p.skillId === skillId);
            if (!alreadyPending) {
                // 添加到待触发队列
                gameState.pendingSkillTriggers.push({ skillId, requiredCount });
                console.log(`技能${skillId}已就绪！已加入待触发队列`);
            }
        }
    });
    
    // 检查技能5（幸运王冕）的触发 - 被动技能，无需携带
    checkSkill5Trigger();
}

// 检查技能5（幸运王冕）的触发
function checkSkill5Trigger() {
    // 技能5是被动技能，通关第8关后解锁，无需携带即可生效
    if (gameState.skills[5].unlocked && gameState.skills[5].passive) {
        // 幸运王冕需要15个猕猴桃才能触发
        if (gameState.skills[5].count >= 15) {
            console.log('幸运王冕已就绪！触发被动效果');
            useSkill5();
        }
    }
}

// 技能5：幸运王冕（被动技能）
function useSkill5() {
    // 增加技能触发计数
    gameState.skillTriggerCounts[5]++;
    console.log(`幸运王冕已触发 ${gameState.skillTriggerCounts[5]} 次`);
    
    // 更新技能触发次数弹窗
    updateSkillTriggerModal();
    
    // 幸运王冕效果：接下来5次消除每次额外获得12分
    gameState.luckyCrownActive = 5;
    console.log('幸运王冕效果激活：接下来5次消除每次额外+12分');
    
    // 消耗猕猴桃计数（消耗15个）
    gameState.skills[5].count -= 15;
    if (gameState.skills[5].count < 0) {
        gameState.skills[5].count = 0;
    }
    
    updateSkillProgress();
    
    // 显示幸运王冕触发弹窗
    showLuckyCrownModal();
    
    // 启动绿色发光粒子效果
    startCrownParticleEffect();
}

// 显示幸运王冕触发弹窗
function showLuckyCrownModal() {
    const modal = document.getElementById('luckyCrownModal');
    if (!modal) return;
    
    // 移除之前的动画类
    modal.classList.remove('fade-out');
    modal.classList.remove('show');
    
    // 强制重绘
    void modal.offsetWidth;
    
    // 显示弹窗
    modal.classList.add('show');
    
    // 5秒后淡出消失
    setTimeout(() => {
        modal.classList.add('fade-out');
        setTimeout(() => {
            modal.classList.remove('show');
            modal.classList.remove('fade-out');
        }, 500);
    }, 5000);
}

// 幸运王冕发光效果管理
function startCrownParticleEffect() {
    const gridWrapper = document.querySelector('.game-grid-wrapper');
    if (gridWrapper) {
        gridWrapper.classList.add('crown-active');
    }
}

// 停止幸运王冕发光效果
function stopCrownParticleEffect() {
    const gridWrapper = document.querySelector('.game-grid-wrapper');
    if (gridWrapper) {
        gridWrapper.classList.remove('crown-active');
    }
}

// 技能下落完成后的检查（用于优先级控制）
function checkSkillTriggersAfterDrop() {
    let skillTriggered = false;

    // 如果十字激光正在执行，不触发任何技能
    if (gameState.crossLaserInProgress) {
        return;
    }

    if (gameState.pendingRemainingGroups && gameState.pendingRemainingGroups.length > 0) {
        const pendingGroups = gameState.pendingRemainingGroups;
        gameState.pendingRemainingGroups = null;
        gameState.skillInProgress = false;
        processMatchGroupsSequentially(pendingGroups);
        return;
    }

    // 检查待触发队列中是否有技能需要触发
    while (gameState.pendingSkillTriggers.length > 0) {
        const pendingSkill = gameState.pendingSkillTriggers.shift();
        const { skillId, requiredCount } = pendingSkill;
        
        // 再次检查是否满足触发条件（防止状态变化）
        const canTrigger = skillId < 5 && 
                          gameState.skills[skillId].count >= requiredCount && 
                          gameState.skills[skillId].unlocked &&
                          gameState.skills[skillId].auto &&
                          (skillId !== 4 || gameState.skill4CooldownRounds === 0) &&
                          (skillId !== 3 || !gameState.crossLaserLocked);
        
        if (canTrigger) {
            console.log(`技能${skillId}已就绪！从队列中触发`);
            
            skillTriggered = true;
            
            // 消耗技能所需的水果数量（确保不会出现负数）
            gameState.skills[skillId].count -= requiredCount;
            if (gameState.skills[skillId].count < 0) {
                gameState.skills[skillId].count = 0;
            }
            
            // 锁定棋盘状态，禁止新的消除检索和操作
            gameState.isProcessingLocked = true;
            gameState.isAnimationLocked = true;
            
            switch (skillId) {
                case 1:
                    useSkill1();
                    break;
                case 2:
                    useSkill2();
                    break;
                case 3:
                    useSkill3();
                    break;
                case 4:
                    useSkill4();
                    break;
            }
            
            // 技能触发后跳出循环，等待技能执行完毕
            return;
        }
    }

    if (!skillTriggered) {
        gameState.skillInProgress = false;
        // 检查是否所有已选择的技能都已关闭自动触发
        const allAutoDisabled = gameState.selectedSkills.every(skillId => 
            gameState.skills[skillId] && !gameState.skills[skillId].auto
        );
        
        if (allAutoDisabled) {
            // 所有技能自动触发都已关闭，直接释放所有锁并重置状态
            console.log('所有技能自动触发已关闭，释放所有锁');
            gameState.isProcessingLocked = false;
            gameState.isAnimationLocked = false;
            gameState.isAnimating = false;
            gameState.inRound = false;
            return;
        }
        
        const newGroups = findMatchGroups();
        if (newGroups.length > 0) {
            processMatchGroupsSequentiallyWithCallback(newGroups, null);
        } else {
            gameState.isAnimating = false;
        }
    }
}

// 带优先级控制的技能触发检查（下落后调用）
function checkSkillTriggersWithPriorityAfterDrop(callback) {
    let skillTriggered = false;
    let crossLaserPending = false; // 十字激光是否需要延迟触发
    
    // 检查是否所有已选择的技能都已关闭自动触发
    const allAutoDisabled = gameState.selectedSkills.every(skillId => 
        gameState.skills[skillId] && !gameState.skills[skillId].auto
    );
    
    // 如果所有技能自动触发都已关闭，直接执行回调并释放锁
    if (allAutoDisabled) {
        console.log('所有技能自动触发已关闭，直接执行回调');
        if (callback) callback();
        return;
    }
    
    // 遍历技能，检查是否有技能准备就绪
    for (const skillId of gameState.selectedSkills) {
        // 获取技能触发所需的水果数量
        // 技能4（全域重塑）需要15个葡萄，技能5（幸运王冕）需要15个水果
        const requiredCount = skillId === 1 ? 9 : skillId === 2 ? 8 : skillId === 3 ? 9 : 15;
        
        // 检查是否满足触发条件（数量足够且技能已解锁）
        // 技能4（全域重塑）需要额外检查冷却状态
        const canTrigger = skillId < 5 && 
                          gameState.skills[skillId].count >= requiredCount && 
                          gameState.skills[skillId].unlocked && 
                          gameState.skills[skillId].auto &&
                          (skillId !== 4 || gameState.skill4CooldownRounds === 0);
        
        if (canTrigger) {
            // 十字激光（技能3）需要延迟触发，等所有消除和下落完成后再触发
            if (skillId === 3) {
                // 检查当前是否正在进行消除或下落
                if (gameState.isProcessingLocked || gameState.isAnimationLocked || gameState.isAnimating) {
                    // 正在处理中，锁定十字激光，等待处理完成后再解锁
                    console.log(`十字激光已就绪，但当前正在处理中，已锁定！`);
                    gameState.crossLaserLocked = true;
                    gameState.crossLaserPendingCallback = callback; // 保存回调
                    crossLaserPending = true;
                    continue; // 跳过当前循环，等待解锁后触发
                }
                
                console.log(`十字激光已就绪，立即触发！`);
                crossLaserPending = true;
            }
            
            console.log(`技能${skillId}已就绪，优先触发！`);
            skillTriggered = true;
            
            // 消耗技能所需的水果数量（确保不会出现负数）
            gameState.skills[skillId].count -= requiredCount;
            if (gameState.skills[skillId].count < 0) {
                gameState.skills[skillId].count = 0;
            }
            
            // 使用requestAnimationFrame确保DOM渲染完成后再触发技能
            requestAnimationFrame(() => {
                // 执行技能并等待完成后再继续
                executeSkillWithCallback(skillId, () => {
                    // 技能执行完成后，检查是否有延迟的十字激光需要触发
                    // 只有当锁被激活时，才需要调用 triggerCrossLaserAfterDelay
                    if (crossLaserPending && gameState.crossLaserLocked) {
                        triggerCrossLaserAfterDelay(callback);
                    } else {
                        // 执行回调（继续检查普通消除）
                        if (callback) callback();
                    }
                });
            });
            
            return; // 一次只触发一个技能
        }
    }
    
    // 没有技能触发，检查是否有延迟的十字激光需要触发
    if (!skillTriggered && crossLaserPending) {
        triggerCrossLaserAfterDelay(callback);
    } else if (!skillTriggered && callback) {
        // 没有技能触发，直接执行回调
        callback();
    }
}

// 延迟触发十字激光（确保在消除和下落完成后触发）
// 此函数在锁释放后被调用，此时所有锁都已被释放
function triggerCrossLaserAfterDelay(callback) {
    // 清空待触发回调，防止重复触发
    gameState.crossLaserPendingCallback = null;
    
    // 锁已被释放，直接延迟后触发十字激光
    console.log(`十字激光准备触发！`);
    
    setTimeout(() => {
        // 消耗技能所需的水果数量
        const requiredCount = 9;
        gameState.skills[3].count -= requiredCount;
        if (gameState.skills[3].count < 0) {
            gameState.skills[3].count = 0;
        }
        
        // 执行十字激光技能（使用专用的延迟回调版本）
        executeSkill3WithDelay(callback);
    }, 100); // 延迟0.1秒确保棋盘稳定
}

// 执行十字激光技能（带延迟回调）
function executeSkill3WithDelay(callback) {
    // 设置技能正在执行的标志
    gameState.skillInProgress = true;
    gameState.crossLaserInProgress = true; // 标记十字激光正在执行
    
    // 执行十字激光技能
    useSkill3();
    
    // 替换原有的pendingSkillCallback逻辑，实现延迟检索和消除
    gameState.pendingSkillCallback = () => {
        gameState.crossLaserInProgress = false; // 标记十字激光执行完成
        
        // 技能执行完成后，延迟0.05秒再允许棋盘检索
        setTimeout(() => {
            // 检索可消除的水果组别
            const groups = findMatchGroups();
            
            // 检索完后再延迟0.05秒才能执行消除
            setTimeout(() => {
                if (groups.length > 0) {
                    // 有可消除的组别，继续处理
                    processMatchGroupsSequentiallyWithCallback(groups, () => {
                        if (callback) callback();
                    });
                } else {
                    // 没有可消除的组别，直接执行回调
                    if (callback) callback();
                }
            }, 50); // 检索完后延迟0.05秒执行消除
        }, 50); // 技能完成后延迟0.05秒检索
    };
}

// 执行技能并在完成后调用回调
function executeSkillWithCallback(skillId, callback) {
    // 设置技能正在执行的标志
    gameState.skillInProgress = true;
    
    // 保存回调，供技能完成时调用
    gameState.pendingSkillCallback = callback;
    
    // 执行技能
    switch (skillId) {
        case 1:
            useSkill1();
            break;
        case 2:
            useSkill2();
            break;
        case 3:
            useSkill3();
            break;
        case 4:
            useSkill4();
            break;
        default:
            gameState.skillInProgress = false;
            if (callback) callback();
    }
}

// 移除匹配的水果
// 参数：
//   matches: 要消除的单元格列表
//   allowHighlightedGrape: 是否允许消除高亮葡萄（玩家操作时为true）
function removeMatches(matches, allowHighlightedGrape = false) {
    let highlightedGrapeRemoved = false;
    
    matches.forEach(match => {
        // 高亮葡萄不能被普通消除方式消除，只能由玩家操作消除
        if (isHighlightedGrape(match.row, match.col)) {
            if (!allowHighlightedGrape) {
                // 非玩家操作，跳过消除高亮葡萄
                return;
            }
            // 玩家操作，允许消除高亮葡萄
            highlightedGrapeRemoved = true;
        }
        
        gameState.gameGrid[match.row][match.col] = null;
        
        // 如果移除的是高亮葡萄，清除该高亮状态
        removeHighlightedGrape(match.row, match.col);
    });
    
    // 如果消除了高亮葡萄，获得40分
    if (highlightedGrapeRemoved) {
        gameState.score += 40;
        updateGameInfo();
    }
}

// 下落填充动画
// 支持动画阶段控制：下落动画阶段 + 落地动画阶段
// 参数：
//   matches: 被消除的单元格列表
//   callback: 下落完成后的回调（在落地动画完成后触发）
//   options: 动画选项 { playLanding: 是否播放落地动画, isPlayerAction: 是否为玩家操作 }
function dropCellsWithAnimation(matches, callback = null, options = {}) {
    const { playLanding = true, isPlayerAction = false } = options;
    
    const columnsToUpdate = new Set();
    matches.forEach(match => {
        columnsToUpdate.add(match.col);
    });

    const columnDropData = [];
    const movingCells = []; // 记录实际发生移动的水果
    const landingCells = []; // 需要播放落地动画的单元格
    
    // 跟踪高亮葡萄的位置变化
    let highlightedGrapeMoved = false;
    let newHighlightedGrapePos = null;

    for (const col of columnsToUpdate) {
        const matchedRows = matches
            .filter(m => m.col === col)
            .map(m => m.row);

        if (matchedRows.length === 0) continue;

        const minMatchedRow = Math.min(...matchedRows);
        const maxMatchedRow = Math.max(...matchedRows);
        let dropCount = 0;

        // 收集该列中所有可用的水果（从上到下，排除被消除的行）
        const availableFruits = [];
        for (let row = 0; row < GRID_SIZE; row++) {
            if (!matchedRows.includes(row) && gameState.gameGrid[row][col] !== null) {
                availableFruits.push({
                    fromRow: row,
                    fruit: gameState.gameGrid[row][col],
                    isHighlighted: isHighlightedGrape(row, col)
                });
            }
        }

        // 清空该列所有单元格（为重新填充做准备）
        for (let row = 0; row < GRID_SIZE; row++) {
            gameState.gameGrid[row][col] = null;
        }

        // 收集需要更新位置的高亮葡萄
        const grapesToUpdate = [];
        
        // 从底部向上重新填充该列
        // 首先使用收集到的水果，然后生成新水果
        let fruitIndex = availableFruits.length - 1; // 从最后一个水果开始（最底部的可用水果）
        
        for (let row = GRID_SIZE - 1; row >= 0; row--) {
            if (fruitIndex >= 0) {
                // 使用已有的水果
                const fruitInfo = availableFruits[fruitIndex];
                const dropDistance = row - fruitInfo.fromRow;
                
                if (dropDistance > 0) {
                    movingCells.push({
                        fromRow: fruitInfo.fromRow,
                        toRow: row,
                        col: col,
                        fruit: fruitInfo.fruit
                    });
                    landingCells.push({ row, col });
                }
                
                gameState.gameGrid[row][col] = fruitInfo.fruit;
                
                // 如果这是高亮葡萄，记录需要更新的位置
                if (fruitInfo.isHighlighted) {
                    grapesToUpdate.push({ oldRow: fruitInfo.fromRow, oldCol: col, newRow: row, newCol: col });
                }
                
                fruitIndex--;
                dropCount++;
            } else {
                // 生成新水果
                const newFruit = FRUITS[Math.floor(Math.random() * FRUITS.length)];
                gameState.gameGrid[row][col] = newFruit;
                dropCount++;
                movingCells.push({
                    fromRow: -1,
                    toRow: row,
                    col: col,
                    fruit: newFruit
                });
                landingCells.push({ row, col });
            }
        }

        // 更新高亮葡萄的位置
        grapesToUpdate.forEach(grape => {
            removeHighlightedGrape(grape.oldRow, grape.oldCol);
            addHighlightedGrape(grape.newRow, grape.newCol);
        });

        if (dropCount > 0) {
            columnDropData.push({
                col,
                dropCount,
                minMatchedRow
            });
        } else {
            columnDropData.push({ col, dropCount: 0 });
        }
    }
    
    const columnsWithDrop = columnDropData.filter(d => d.dropCount > 0);

    if (columnsWithDrop.length === 0) {
        if (callback) callback();
        return;
    }

    // 更新动画阶段状态
    gameState.animationPhase = 'dropping';
    gameState.isPlayerAction = isPlayerAction;
    
    // 保存需要播放落地动画的单元格
    if (playLanding) {
        gameState.pendingLandingCells = landingCells;
    } else {
        gameState.pendingLandingCells = [];
    }

    renderGrid();

    // 下落动画时长（加快到0.3秒）
    const dropDuration = 0.3;
    
    // 只为实际发生移动的水果添加下落动画
    movingCells.forEach(move => {
        const cell = document.querySelector(`[data-row="${move.toRow}"][data-col="${move.col}"]`);
        if (cell && !cell.classList.contains('empty-cell')) {
            cell.style.animationDuration = `${dropDuration}s`;
            cell.classList.add('dropping');
        }
    });

    // 触发逻辑处理的时机：
    // 所有情况（玩家操作和自动消除）都在落地动画完成后触发，确保流程正确
    // 下落动画(300ms) + 落地动画(200ms) = 500ms 后触发回调
    const triggerTime = dropDuration;

    // 播放落地动画并触发回调
    if (playLanding) {
        setTimeout(() => {
            // 先清理下落动画类（确保状态干净）
            document.querySelectorAll('.grid-cell.dropping').forEach(cell => {
                cell.classList.remove('dropping');
            });
            
            gameState.animationPhase = 'landing';
            
            if (gameState.pendingLandingCells.length > 0) {
                playLandingAnimation(gameState.pendingLandingCells);
                
                // 落地动画完成后触发回调（落地动画约200ms）
                setTimeout(() => {
                    gameState.animationPhase = 'idle';
                    
                    // 下落动画完成后0.1秒解锁十字激光并触发
                    if (gameState.crossLaserLocked) {
                        const savedCallback = gameState.crossLaserPendingCallback;
                        setTimeout(() => {
                            gameState.crossLaserLocked = false;
                            console.log('十字激光已解锁');
                            // 锁释放后自动触发十字激光
                            if (savedCallback) {
                                triggerCrossLaserAfterDelay(savedCallback);
                            }
                        }, 100);
                    }
                    
                    if (callback) callback();
                }, 200);
            } else {
                gameState.animationPhase = 'idle';
                
                // 下落动画完成后0.1秒解锁十字激光并触发
                if (gameState.crossLaserLocked) {
                    const savedCallback = gameState.crossLaserPendingCallback;
                    setTimeout(() => {
                        gameState.crossLaserLocked = false;
                        console.log('十字激光已解锁');
                        // 锁释放后自动触发十字激光
                        if (savedCallback) {
                            triggerCrossLaserAfterDelay(savedCallback);
                        }
                    }, 100);
                }
                
                if (callback) callback();
            }
        }, triggerTime * 1000);
    } else {
        // 不播放落地动画时，在下落到完成后直接触发回调
        setTimeout(() => {
            // 清理下落动画类
            document.querySelectorAll('.grid-cell.dropping').forEach(cell => {
                cell.classList.remove('dropping');
            });
            gameState.animationPhase = 'idle';
            
            // 下落动画完成后0.1秒解锁十字激光并触发
            if (gameState.crossLaserLocked) {
                const savedCallback = gameState.crossLaserPendingCallback;
                setTimeout(() => {
                    gameState.crossLaserLocked = false;
                    console.log('十字激光已解锁');
                    // 锁释放后自动触发十字激光
                    if (savedCallback) {
                        triggerCrossLaserAfterDelay(savedCallback);
                    }
                }, 100);
            }
            
            if (callback) callback();
        }, triggerTime * 1000);
    }
}

// 清理所有动画类
function clearAllAnimationClasses() {
    document.querySelectorAll('.grid-cell.popping').forEach(cell => {
        cell.classList.remove('popping');
    });
    document.querySelectorAll('.grid-cell.dropping').forEach(cell => {
        cell.classList.remove('dropping');
    });
    document.querySelectorAll('.grid-cell.landing').forEach(cell => {
        cell.classList.remove('landing');
    });
    document.querySelectorAll('.grid-cell.pre-eliminate').forEach(cell => {
        cell.classList.remove('pre-eliminate');
    });
}

// 播放落地动画
function playLandingAnimation(cells) {
    cells.forEach(cellInfo => {
        const cell = document.querySelector(`[data-row="${cellInfo.row}"][data-col="${cellInfo.col}"]`);
        if (cell && !cell.classList.contains('empty-cell')) {
            cell.classList.add('landing');
        }
    });
    
    // 落地动画结束后清理
    setTimeout(() => {
        document.querySelectorAll('.grid-cell.landing').forEach(cell => {
            cell.classList.remove('landing');
        });
        gameState.animationPhase = 'idle';
        gameState.pendingLandingCells = [];
    }, 200);
}

// 为最后下落的水果补回落地动画
function playPendingLandingAnimation() {
    if (gameState.pendingLandingCells.length > 0) {
        playLandingAnimation(gameState.pendingLandingCells);
    }
}

// 检查下落填充后的新匹配（带优先级控制）
function checkNewMatchesAfterDrop(callback) {
    const newGroups = findMatchGroups();

    if (newGroups.length > 0) {
        // 下落填充后形成的新匹配需要等技能处理完成才能继续
        // 先暂停，等技能处理完成后再继续
        processMatchGroupsSequentiallyWithCallback(newGroups, callback);
    } else {
        gameState.comboCount = 0;
        gameState.isAnimating = false;
        if (callback) callback();
    }
}

// 带回调的顺序处理匹配组
function processMatchGroupsSequentiallyWithCallback(groups, callback) {
    // 使用同步处理机制
    processAllMatchesSimultaneouslyWithCallback(callback);
}

// 同步处理所有匹配组（带回调）
function processAllMatchesSimultaneouslyWithCallback(finalCallback) {
    // 检查是否正在处理中，防止并发执行
    if (gameState.isProcessingLocked || gameState.isAnimationLocked) {
        console.log('检测到并发消除尝试，已忽略');
        return;
    }
    
    // 锁定消除处理和动画流程
    gameState.isProcessingLocked = true;
    gameState.isAnimationLocked = true;
    
    // 标记进入一轮消除
    gameState.inRound = true;
    
    // 清理之前可能残留的动画类，防止重复播放
    clearAllAnimationClasses();
    
    // 查找所有匹配组
    const matchGroups = findMatchGroups();
    
    if (matchGroups.length === 0) {
        // 如果没有新匹配，为最后下落的水果补回落地动画
        setTimeout(() => {
            if (gameState.pendingLandingCells.length > 0) {
                playLandingAnimation(gameState.pendingLandingCells);
            }
        }, 100);
        gameState.isAnimating = false;
        gameState.isProcessingLocked = false; // 释放锁
        gameState.isAnimationLocked = false; // 释放动画锁
        gameState.inRound = false; // 标记一轮结束
        
        checkAndShowGameOver(); // 检查是否需要显示游戏结束弹窗
        if (finalCallback) finalCallback();
        return;
    }
    
    // 将所有组的cells合并为一个集合（去重）
    const allMatchCells = [];
    const cellSet = new Set();
    
    matchGroups.forEach(group => {
        group.cells.forEach(cell => {
            const key = `${cell.row},${cell.col}`;
            if (!cellSet.has(key)) {
                cellSet.add(key);
                allMatchCells.push(cell);
            }
        });
    });
    
    // 计算总消除数量，决定是否显示粒子效果
    const totalMatchCount = allMatchCells.length;
    
    // 处理所有匹配组的分数和技能计数
    processAllMatchScores(matchGroups);
    
    // 根据消除数量决定粒子效果
    // - 消除数量 <= 21：显示粒子效果
    // - 消除数量 > 21：减少粒子效果（性能优化）
    const shouldShowParticles = totalMatchCount <= 21;
    
    // 显示预消除效果，然后执行消除动画
    showPreEliminateEffect(allMatchCells, () => {
        // 播放消除动画（同步播放所有消除）
        showPopAnimation(allMatchCells, null, !shouldShowParticles);
        
        // 等待消除动画完成（动画时长为0.35s）
        setTimeout(() => {
            // 移除所有匹配的水果
            removeMatches(allMatchCells);
            
            // 先移除带有popping类的单元格，避免renderGrid删除它们
            allMatchCells.forEach(match => {
                const cell = document.querySelector(`[data-row="${match.row}"][data-col="${match.col}"]`);
                if (cell) {
                    cell.remove();
                }
            });
            
            // 执行下落填充（使用与玩家操作相同的参数，确保速度一致）
            // 技能触发后的连锁反应也播放完整的下落+落地动画
            const dropOptions = {
                playLanding: true,
                isPlayerAction: false // 标记为非玩家操作，但仍播放完整动画
            };
            
            dropCellsWithAnimation(allMatchCells, () => {
                // 回调已经在落地动画完成后触发
                
                // 标记本轮消除结束
                gameState.inRound = false;
                
                // 如果有全域重塑冷却，减少冷却轮数
                if (gameState.skill4CooldownRounds > 0) {
                    gameState.skill4CooldownRounds--;
                    console.log(`全域重塑冷却剩余: ${gameState.skill4CooldownRounds} 轮`);
                }
                
                // 先检查技能触发（技能优先级高于普通消除）
                checkSkillTriggers();
                
                // 检查是否有待触发的技能
                if (gameState.pendingSkillTriggers.length > 0) {
                    // 有技能等待触发，释放锁后让技能触发逻辑处理
                    gameState.isProcessingLocked = false;
                    gameState.isAnimationLocked = false;
                    checkSkillTriggersAfterDrop();
                    return;
                }
                
                // 释放锁并检查新一轮消除（最多10次连锁）
                gameState.isProcessingLocked = false;
                gameState.isAnimationLocked = false;
                gameState.comboCount++;
                if (gameState.comboCount <= 10) {
                    processAllMatchesSimultaneouslyWithCallback(finalCallback);
                } else {
                    gameState.comboCount = 0;
                    gameState.isAnimating = false;
                    checkAndShowGameOver(); // 检查是否需要显示游戏结束弹窗
                    if (finalCallback) finalCallback();
                }
            }, dropOptions);
        }, 350); // 消除动画时长
    });
}

// 检查新的匹配
function checkNewMatches() {
    let matches = [];
    
    for (let row = 0; row < GRID_SIZE; row++) {
        for (let col = 0; col < GRID_SIZE; col++) {
            if (gameState.gameGrid[row][col] !== null) {
                const horizontalMatch = checkHorizontalMatch(row, col);
                const verticalMatch = checkVerticalMatch(row, col);
                
                if (horizontalMatch.length >= 3) {
                    matches = [...matches, ...horizontalMatch];
                    break;
                }
                if (verticalMatch.length >= 3) {
                    matches = [...matches, ...verticalMatch];
                    break;
                }
            }
        }
        if (matches.length > 0) break;
    }
    
    if (matches.length > 0) {
        const uniqueMatches = new Set(matches.map(match => `${match.row},${match.col}`));
        const matchArray = Array.from(uniqueMatches).map(str => {
            const [row, col] = str.split(',').map(Number);
            return { row, col };
        });
        
        if (matchArray.length > 6) {
            matchArray.splice(6);
        }
        
        processMatches(matchArray);
    } else {
        gameState.comboCount = 0;
        gameState.isAnimating = false;
        checkAndShowGameOver(); // 检查是否需要显示游戏结束弹窗
    }
}

// 触发技能
function triggerSkill() {
    for (const skillId of gameState.selectedSkills) {
        // 获取技能触发所需的水果数量
        const requiredCount = skillId === 1 ? 9 : skillId === 2 ? 8 : skillId === 3 ? 9 : 15;
        if (gameState.skills[skillId].count >= requiredCount) {
            switch (skillId) {
                case 1:
                    useSkill1();
                    break;
                case 2:
                    useSkill2();
                    break;
                case 3:
                    useSkill3();
                    break;
                case 4:
                    useSkill4();
                    break;
            }
            break;
        }
    }
}

// 技能1：声东击西
function useSkill1() {
    gameState.isAnimating = true;
    gameState.skillInProgress = true; // 标记技能开始
    updateSkillProgress();
    
    // 增加技能触发计数
    gameState.skillTriggerCounts[1]++;
    console.log(`声东击西已触发 ${gameState.skillTriggerCounts[1]} 次`);
    
    // 更新技能触发次数弹窗
    updateSkillTriggerModal();

    // 随机选择两处2×2区域（不重叠）
    const areas = [];
    while (areas.length < 2) {
        const row = Math.floor(Math.random() * (GRID_SIZE - 1));
        const col = Math.floor(Math.random() * (GRID_SIZE - 1));
        
        // 检查与已选区域是否重叠
        let isOverlapping = false;
        for (const area of areas) {
            // 检查两个2×2区域是否重叠
            const rowOverlap = Math.abs(row - area.row) < 2;
            const colOverlap = Math.abs(col - area.col) < 2;
            if (rowOverlap && colOverlap) {
                isOverlapping = true;
                break;
            }
        }
        
        if (!isOverlapping) {
            areas.push({ row, col });
        }
    }

    // 标记区域
    areas.forEach(area => {
        for (let i = 0; i < 2; i++) {
            for (let j = 0; j < 2; j++) {
                const cell = document.querySelector(`[data-row="${area.row + i}"][data-col="${area.col + j}"]`);
                if (cell) {
                    cell.style.boxShadow = '0 0 10px red';
                }
            }
        }
    });

    setTimeout(() => {
        // 消除区域内的水果（排除高亮葡萄）
        let matches = [];
        areas.forEach(area => {
            for (let i = 0; i < 2; i++) {
                for (let j = 0; j < 2; j++) {
                    const row = area.row + i;
                    const col = area.col + j;
                    // 跳过高亮葡萄
                    if (!isHighlightedGrape(row, col)) {
                        matches.push({ row, col });
                    }
                }
            }
        });

        // 如果没有要消除的水果，直接结束
        if (matches.length === 0) {
            gameState.skillInProgress = false;
            gameState.isAnimating = false;
            checkSkillTriggersAfterDrop();
            return;
        }

        // 计分 - 声东击西固定获得15分
        gameState.score += 15;
        updateGameInfo();

        // 显示预消除效果，然后执行消除动画
        showPreEliminateEffect(matches, () => {
            // 播放消除动画（技能1触发，按100%计算计入）
            showPopAnimation(matches, 1, false, 1);

            setTimeout(() => {
                removeMatches(matches);
                renderGrid();

                // 消除动画完成后触发下落
                dropCellsWithAnimation(matches, () => {
                    // 技能处理完成，释放所有锁
                    gameState.isProcessingLocked = false;
                    gameState.isAnimationLocked = false;
                    gameState.skillInProgress = false;
                    
                    if (gameState.pendingSkillCallback) {
                        const callback = gameState.pendingSkillCallback;
                        gameState.pendingSkillCallback = null;
                        callback();
                    } else {
                        checkSkillTriggersAfterDrop();
                    }
                });
            }, 350);
        });
    }, 300);
}

// 技能2：中心爆破
function useSkill2() {
    gameState.isAnimating = true;
    gameState.skillInProgress = true; // 标记技能开始
    updateSkillProgress();
    
    // 增加技能触发计数
    gameState.skillTriggerCounts[2]++;
    console.log(`中心爆破已触发 ${gameState.skillTriggerCounts[2]} 次`);
    
    // 更新技能触发次数弹窗
    updateSkillTriggerModal();

    // 随机选择一处3×3区域
    const row = Math.floor(Math.random() * (GRID_SIZE - 2));
    const col = Math.floor(Math.random() * (GRID_SIZE - 2));

    // 标记区域 - 强化预消除效果
    for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
            const cell = document.querySelector(`[data-row="${row + i}"][data-col="${col + j}"]`);
            if (cell) {
                cell.style.boxShadow = '0 0 20px 5px rgba(59, 130, 246, 0.9)';
                cell.style.transform = 'scale(1.1)';
                cell.style.transition = 'all 0.3s ease';
                cell.style.backgroundColor = 'rgba(59, 130, 246, 0.3)';
            }
        }
    }

    setTimeout(() => {
        // 消除区域内的水果（排除高亮葡萄）
        let matches = [];
        for (let i = 0; i < 3; i++) {
            for (let j = 0; j < 3; j++) {
                const r = row + i;
                const c = col + j;
                // 跳过高亮葡萄
                if (!isHighlightedGrape(r, c)) {
                    matches.push({ row: r, col: c });
                }
            }
        }

        // 如果没有要消除的水果，直接结束
        if (matches.length === 0) {
            gameState.skillInProgress = false;
            gameState.isAnimating = false;
            checkSkillTriggersAfterDrop();
            return;
        }

        // 计分 - 中心爆破固定获得20分
        gameState.score += 20;
        updateGameInfo();

        // 显示预消除效果，然后执行消除动画
        showPreEliminateEffect(matches, () => {
            // 播放消除动画（技能2触发，按100%计算计入）
            showPopAnimation(matches, 2, false, 1);

            setTimeout(() => {
                removeMatches(matches);
                renderGrid();

                // 消除动画完成后触发下落
                dropCellsWithAnimation(matches, () => {
                    // 技能处理完成，释放所有锁
                    gameState.isProcessingLocked = false;
                    gameState.isAnimationLocked = false;
                    gameState.skillInProgress = false;
                    
                    if (gameState.pendingSkillCallback) {
                        const callback = gameState.pendingSkillCallback;
                        gameState.pendingSkillCallback = null;
                        callback();
                    } else {
                        checkSkillTriggersAfterDrop();
                    }
                });
            }, 350);
        });
    }, 300);
}

// 技能3：十字激光
function useSkill3() {
    gameState.isAnimating = true;
    gameState.skillInProgress = true; // 标记技能开始
    updateSkillProgress();
    
    // 增加技能触发计数
    gameState.skillTriggerCounts[3]++;
    console.log(`十字激光已触发 ${gameState.skillTriggerCounts[3]} 次`);
    
    // 更新技能触发次数弹窗
    updateSkillTriggerModal();

    // AI随机选择一个水果作为中心
    const row = Math.floor(Math.random() * GRID_SIZE);
    const col = Math.floor(Math.random() * GRID_SIZE);
    processCrossLaser(row, col);
}

// 处理十字激光
function processCrossLaser(row, col) {
    // 计算十字区域（排除高亮葡萄）
    let matches = [];

    // 水平方向
    for (let i = 0; i < GRID_SIZE; i++) {
        // 跳过高亮葡萄
        if (isHighlightedGrape(i, col)) {
            continue;
        }
        matches.push({ row: i, col });
    }

    // 垂直方向
    for (let i = 0; i < GRID_SIZE; i++) {
        if (i !== col) {
            // 跳过高亮葡萄
            if (isHighlightedGrape(row, i)) {
                continue;
            }
            matches.push({ row, col: i });
        }
    }

    // 如果没有要消除的水果（只剩高亮葡萄），直接结束
    if (matches.length === 0) {
        gameState.skillInProgress = false;
        gameState.isAnimating = false;
        checkSkillTriggersAfterDrop();
        return;
    }

    // 标记区域 - 强化预消除效果
    matches.forEach(match => {
        const cell = document.querySelector(`[data-row="${match.row}"][data-col="${match.col}"]`);
        if (cell) {
            cell.style.boxShadow = '0 0 20px 5px rgba(249, 115, 22, 0.9)';
            cell.style.transform = 'scale(1.1)';
            cell.style.transition = 'all 0.3s ease';
            cell.style.backgroundColor = 'rgba(249, 115, 22, 0.3)';
        }
    });

    setTimeout(() => {
        // 计分 - 十字激光固定获得25分
        gameState.score += 25;
        updateGameInfo();

        // 显示预消除效果，然后执行消除动画
        showPreEliminateEffect(matches, () => {
            // 预消除后延迟0.05秒再执行消除动画
            setTimeout(() => {
                // 播放消除动画（技能3触发，按50%计算计入，十字激光特殊粒子效果）
                showPopAnimation(matches, 3, false, 0.5, true);

                setTimeout(() => {
                    removeMatches(matches);
                    renderGrid();

                    // 消除动画完成后触发下落
                    dropCellsWithAnimation(matches, () => {
                        // 技能处理完成，释放所有锁
                        gameState.isProcessingLocked = false;
                        gameState.isAnimationLocked = false;
                        gameState.skillInProgress = false;
                        
                        if (gameState.pendingSkillCallback) {
                            const callback = gameState.pendingSkillCallback;
                            gameState.pendingSkillCallback = null;
                            callback();
                        } else {
                            checkSkillTriggersAfterDrop();
                        }
                    });
                }, 450); // 消除步骤推后0.1秒（350ms → 450ms）
            }, 50); // 预消除后延迟0.05秒再消除
        });
    }, 200); // 预消除时间从0.4秒缩减到0.2秒
}

// 技能4：全域重塑（改为高亮葡萄机制）
function useSkill4() {
    gameState.isAnimating = true;
    gameState.skillInProgress = true; // 标记技能开始
    updateSkillProgress();
    
    // 增加技能触发计数
    gameState.skillTriggerCounts[4]++;
    console.log(`全域重塑已触发 ${gameState.skillTriggerCounts[4]} 次`);
    
    // 更新技能触发次数弹窗
    updateSkillTriggerModal();

    // 设置全域重塑冷却3轮
    gameState.skill4CooldownRounds = 3;
    console.log('全域重塑已触发，冷却3轮');

    // 查找场上所有葡萄的位置
    const grapePositions = [];
    for (let r = 0; r < GRID_SIZE; r++) {
        for (let c = 0; c < GRID_SIZE; c++) {
            if (gameState.gameGrid[r][c] === 'grape') {
                grapePositions.push({ row: r, col: c });
            }
        }
    }
    
    // 如果场上没有葡萄，随机选择一个位置生成葡萄
    let selectedRow, selectedCol;
    if (grapePositions.length > 0) {
        // 随机选择一个葡萄
        const randomIndex = Math.floor(Math.random() * grapePositions.length);
        selectedRow = grapePositions[randomIndex].row;
        selectedCol = grapePositions[randomIndex].col;
    } else {
        // 随机选择一个位置生成葡萄
        selectedRow = Math.floor(Math.random() * GRID_SIZE);
        selectedCol = Math.floor(Math.random() * GRID_SIZE);
        gameState.gameGrid[selectedRow][selectedCol] = 'grape';
    }
    
    // 添加高亮葡萄（最多2个）
    const added = addHighlightedGrape(selectedRow, selectedCol);
    
    if (!added) {
        // 如果高亮葡萄已达上限，不执行后续效果
        console.log('高亮葡萄已达上限，跳过技能效果');
        gameState.skillInProgress = false;
        gameState.isAnimating = false;
        return;
    }
    
    // 重新渲染网格
    renderGrid();
    
    // 添加高亮葡萄的特殊样式和粒子效果
    setTimeout(() => {
        const cell = document.querySelector(`[data-row="${selectedRow}"][data-col="${selectedCol}"]`);
        if (cell) {
            cell.classList.add('highlighted-grape');
            // 创建粒子闪烁效果
            createHighlightParticles(selectedRow, selectedCol);
        }
        
        // 技能处理完成，释放所有锁并检查新的技能触发
        gameState.skillInProgress = false;
        gameState.isAnimating = false;
        gameState.isProcessingLocked = false;
        gameState.isAnimationLocked = false;
        checkSkillTriggersAfterDrop();
    }, 100);
}

// 创建高亮葡萄的粒子闪烁效果
function createHighlightParticles(row, col) {
    const cell = document.querySelector(`[data-row="${row}"][data-col="${col}"]`);
    if (!cell) return;
    
    const rect = cell.getBoundingClientRect();
    const gridRect = elements.gameGrid.getBoundingClientRect();
    const x = rect.left - gridRect.left + rect.width / 2;
    const y = rect.top - gridRect.top + rect.height / 2;
    
    // 持续创建闪烁粒子
    const particleInterval = setInterval(() => {
        // 检查高亮葡萄是否已被消除
        if (!isHighlightedGrape(row, col)) {
            clearInterval(particleInterval);
            return;
        }
        
        // 创建闪烁粒子
        const particle = document.createElement('div');
        particle.className = 'highlight-particle';
        
        const angle = Math.random() * Math.PI * 2;
        const distance = 10 + Math.random() * 20;
        const px = x + Math.cos(angle) * distance;
        const py = y + Math.sin(angle) * distance;
        const size = 3 + Math.random() * 5;
        
        particle.style.cssText = `
            width: ${size}px;
            height: ${size}px;
            left: ${px}px;
            top: ${py}px;
            background: radial-gradient(circle, #9b59b6 0%, #8e44ad 50%, transparent 100%);
            box-shadow: 0 0 ${size * 2}px rgba(155, 89, 182, 0.8);
        `;
        
        elements.particlesLayer.appendChild(particle);
        
        setTimeout(() => {
            particle.remove();
        }, 600);
    }, 150);
}

// 检查关卡完成条件
function checkLevelComplete() {
    const levelConfig = LEVELS[gameState.currentLevel - 1];
    
    // 无尽模式永远不结束（除了玩家主动结算）
    if (gameState.currentLevel === 11) {
        return false;
    }
    
    // 检查分数条件
    if (gameState.score < levelConfig.goal) {
        return false;
    }
    
    // 检查技能触发条件
    if (levelConfig.skillRequirement) {
        const { triggerCount } = levelConfig.skillRequirement;
        
        // 地狱挑战模式：检查三个技能都达到触发次数要求
        if (gameState.currentLevel === 12 && levelConfig.isHellMode) {
            // 检查玩家携带的主动技能
            if (gameState.selectedSkills && gameState.selectedSkills.length > 0) {
                for (const skillId of gameState.selectedSkills) {
                    if (skillId && skillId !== 5 && gameState.skillTriggerCounts[skillId] < triggerCount) {
                        return false;
                    }
                }
            }
            // 检查幸运王冕被动技能
            if (gameState.skillTriggerCounts[5] < triggerCount) {
                return false;
            }
        } else {
            // 其他关卡：只检查配置的特定技能
            const { skillId } = levelConfig.skillRequirement;
            if (gameState.skillTriggerCounts[skillId] < triggerCount) {
                return false;
            }
        }
    }
    
    return true;
}

// 完成关卡
function completeLevel() {
    // 计算积分
    let points = gameState.score;
    if (gameState.currentLevel <= 10) {
        const maxPoints = LEVELS[gameState.currentLevel - 1].goal * 2;
        points = Math.min(points, maxPoints);
    }
    
    saveData.totalPoints += points;
    
    // 解锁下一关（通关第10关后同时解锁第11关和第12关）
    if (gameState.currentLevel <= 10 && checkLevelComplete()) {
        saveData.unlockedLevels = Math.max(saveData.unlockedLevels, gameState.currentLevel + 1);
        // 通关第10关时，同时解锁第12关（地狱挑战）
        if (gameState.currentLevel === 10) {
            saveData.unlockedLevels = Math.max(saveData.unlockedLevels, 12);
        }
        
        // 解锁对应技能和功能
        if (gameState.currentLevel === 2) {
            // 通关第2关解锁技能2
            saveData.unlockedSkills.push(2);
            gameState.skills[2].unlocked = true;
        } else if (gameState.currentLevel === 4) {
            // 通关第4关解锁技能3
            saveData.unlockedSkills.push(3);
            gameState.skills[3].unlocked = true;
        } else if (gameState.currentLevel === 6) {
            // 通关第6关解锁技能4和第二技能槽
            saveData.unlockedSkills.push(4);
            gameState.skills[4].unlocked = true;
            saveData.maxSkillSlots = 2;
            gameState.maxSkillSlots = 2;
        } else if (gameState.currentLevel === 8) {
            // 通关第8关解锁技能5（被动技能）
            saveData.unlockedSkills.push(5);
            gameState.skills[5].unlocked = true;
            gameState.skills[5].passive = true;
        } else if (gameState.currentLevel === 10) {
            // 通关第10关解锁无尽模式
            // 第11关就是无尽模式，已经包含在unlockedLevels中
        }
    }
    
    saveGameData();
    updateUI();
    
    // 显示结算界面
    elements.finalScore.textContent = gameState.score;
    elements.finalSteps.textContent = gameState.steps;
    elements.finalPoints.textContent = points;
    
    elements.gameInterface.classList.add('hidden');
    elements.levelComplete.classList.remove('hidden');
    
    // 隐藏下一关按钮（如果是最后一关）
    if (gameState.currentLevel >= 11) {
        elements.nextLevel.style.display = 'none';
    } else {
        elements.nextLevel.style.display = 'inline-block';
    }
}

// 获取技能名称
function getSkillName(skillId) {
    const skillNames = {
        1: '声东击西',
        2: '中心爆破',
        3: '十字激光',
        4: '全域重塑',
        5: '幸运王冕'
    };
    return skillNames[skillId] || '';
}

// 获取技能对应的颜色
function getSkillColor(skillId) {
    const colors = {
        1: '#e74c3c', // 声东击西 - 红色
        2: '#3498db', // 中心爆破 - 蓝色
        3: '#f39c12', // 十字激光 - 橙色
        4: '#9b59b6', // 全域重塑 - 紫色
        5: '#27ae60'  // 幸运王冕 - 绿色
    };
    return colors[skillId] || '#333';
}

// 更新关卡信息显示
function updateLevelInfo() {
    const level = gameState.currentLevel;
    const levelTarget = getLevelTarget(level);
    
    if (elements.currentLevel) {
        elements.currentLevel.textContent = '关卡：' + level;
    }
    if (elements.levelTarget) {
        elements.levelTarget.textContent = levelTarget;
    }
    
    // 更新技能推荐
    if (elements.skillRecommendation) {
        // 获取已解锁的技能（排除幸运王冕技能5）
        const unlockedSkills = [];
        for (let i = 1; i <= 4; i++) {
            if (gameState.skills[i].unlocked) {
                unlockedSkills.push(i);
            }
        }
        
        // 根据技能槽数量选择推荐技能
        const slotCount = gameState.maxSkillSlots;
        const recommended = unlockedSkills.slice(-slotCount);
        
        // 生成推荐HTML（带颜色）
        const recommendedSkillsEl = document.getElementById('recommended-skills');
        if (recommendedSkillsEl) {
            const skillElements = recommended.map(id => {
                const color = getSkillColor(id);
                const name = getSkillName(id);
                return `<span style="color: ${color}; font-weight: bold;">${name}</span>`;
            });
            recommendedSkillsEl.innerHTML = skillElements.join('<br>');
        }
    }
}

// 获取关卡目标描述
function getLevelTarget(level) {
    const targets = {
        1: '达到150分\n触发4次声东击西\n限制20步',
        2: '达到200分\n限制25步\n（解锁中心爆破）',
        3: '达到250分\n触发5次中心爆破\n限制30步',
        4: '达到300分\n限制30步\n（解锁十字激光）',
        5: '达到350分\n触发5次十字激光\n限制30步',
        6: '达到400分\n限制35步\n（解锁第二技能槽、全域重塑）',
        7: '达到500分\n触发4次全域重塑\n限制35步',
        8: '达到600分\n限制35步\n（解锁幸运王冕被动技能）',
        9: '达到700分\n触发6次幸运王冕\n限制35步',
        10: '达到1000分\n限制40步',
        11: '无尽模式\n挑战最高分',
        12: '地狱挑战\n45步内达到4000分\n各触发12次携带技能和幸运王冕'
    };
    return targets[level] || '完成关卡任务';
}

// 技能解锁条件
const skillUnlockConditions = {
    1: '初始解锁',
    2: '通关第2关后解锁',
    3: '通关第4关后解锁',
    4: '通关第6关后解锁',
    5: '通关第8关后解锁'
};

// 初始化悬停提示功能
function initSkillTooltips() {
    // 技能槽2的悬停提示
    const slot2 = document.querySelector('.skill-slot-display[data-slot="2"]');
    if (slot2) {
        // 先移除可能存在的事件监听器
        slot2.removeEventListener('mouseenter', slot2TooltipHandler);
        slot2.removeEventListener('mouseleave', hideTooltip);
        
        // 绑定到slot-icon-wrapper，确保悬停在图标上时也能触发
        const wrapper = slot2.querySelector('.slot-icon-wrapper');
        if (wrapper) {
            wrapper.removeEventListener('mouseenter', slot2TooltipHandler);
            wrapper.removeEventListener('mouseleave', hideTooltip);
            wrapper.addEventListener('mouseenter', slot2TooltipHandler);
            wrapper.addEventListener('mouseleave', hideTooltip);
        }
        // 同时绑定到整个slot
        slot2.addEventListener('mouseenter', slot2TooltipHandler);
        slot2.addEventListener('mouseleave', hideTooltip);
    }
    
    // 技能项的悬停提示
    document.querySelectorAll('.skill-select-item').forEach(item => {
        // 先移除可能存在的事件监听器
        item.removeEventListener('mouseenter', skillItemTooltipHandler);
        item.removeEventListener('mouseleave', hideTooltip);
        
        const skillId = parseInt(item.dataset.skill);
        const condition = skillUnlockConditions[skillId];
        if (condition) {
            item.skillCondition = condition;
            item.addEventListener('mouseenter', skillItemTooltipHandler);
            item.addEventListener('mouseleave', hideTooltip);
        }
    });
}

// 技能槽2的悬停处理函数
function slot2TooltipHandler(e) {
    const slot2 = document.querySelector('.skill-slot-display[data-slot="2"]');
    if (slot2 && slot2.classList.contains('locked')) {
        showTooltip(slot2, '通关第六关后解锁第二技能槽');
    }
}

// 技能项的悬停处理函数
function skillItemTooltipHandler(e) {
    const item = e.currentTarget;
    if (item.classList.contains('locked') && item.skillCondition) {
        showTooltip(item, item.skillCondition);
    }
}

// 显示提示弹窗
function showTooltip(element, text) {
    let tooltip = document.querySelector('.skill-tooltip');
    if (!tooltip) {
        tooltip = document.createElement('div');
        tooltip.className = 'skill-tooltip';
        document.body.appendChild(tooltip);
    }
    
    tooltip.textContent = text;
    tooltip.classList.add('visible');
    
    const rect = element.getBoundingClientRect();
    tooltip.style.left = rect.left + rect.width / 2 - tooltip.offsetWidth / 2 + 'px';
    tooltip.style.top = rect.top - tooltip.offsetHeight - 10 + 'px';
}

// 隐藏提示弹窗
function hideTooltip() {
    const tooltip = document.querySelector('.skill-tooltip');
    if (tooltip) {
        tooltip.classList.remove('visible');
    }
}

// 初始化游戏
window.onload = function() {
    initGame();
    initSkillTooltips();
};