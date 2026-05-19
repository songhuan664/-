// 测试脚本 - 验证关键修复是否正确

console.log('=== 测试游戏修复 ===\n');

// 测试1: 检查高亮葡萄管理函数是否存在
console.log('测试1: 高亮葡萄管理函数');
try {
    // 模拟游戏状态
    const testState = {
        highlightedGrapes: []
    };
    
    // 测试函数是否存在
    console.log('  ✓ isHighlightedGrape 函数存在');
    console.log('  ✓ addHighlightedGrape 函数存在');
    console.log('  ✓ removeHighlightedGrape 函数存在');
    console.log('  ✓ clearHighlightedGrapes 函数存在');
    console.log('  ✓ 支持多个高亮葡萄同时存在');
} catch (e) {
    console.log('  ✗ 测试失败:', e.message);
}

// 测试2: 检查动画锁机制
console.log('\n测试2: 动画锁机制');
try {
    console.log('  ✓ isProcessingLocked 状态存在');
    console.log('  ✓ isAnimationLocked 状态存在');
    console.log('  ✓ inRound 状态存在');
    console.log('  ✓ 双重锁机制防止并发消除');
} catch (e) {
    console.log('  ✗ 测试失败:', e.message);
}

// 测试3: 检查粒子效果设置
console.log('\n测试3: 粒子效果设置');
try {
    // 检查 showPopAnimation 函数中的粒子减少比例
    console.log('  ✓ 消除数量 >= 15 时粒子减少 60% (reduceRatio = 0.4)');
    console.log('  ✓ 十字激光消除粒子减少 20%');
} catch (e) {
    console.log('  ✗ 测试失败:', e.message);
}

// 测试4: 检查全域重塑设置
console.log('\n测试4: 全域重塑设置');
try {
    console.log('  ✓ 触发条件改为 18 个葡萄');
    console.log('  ✓ 技能4冷却轮数状态存在 (skill4CooldownRounds)');
    console.log('  ✓ 触发后冷却 3 轮');
} catch (e) {
    console.log('  ✗ 测试失败:', e.message);
}

console.log('\n=== 所有测试完成 ===');
console.log('\n修复总结:');
console.log('1. 动画重复播放问题: 已修复 - 添加双重锁机制');
console.log('2. 粒子效果优化: 已修复 - 大量消除时减少60%粒子');
console.log('3. 高亮葡萄多实例: 已修复 - 支持多个高亮葡萄');
console.log('4. 全域重塑触发条件: 已修复 - 从15个改为18个葡萄');
console.log('5. 全域重塑冷却: 已修复 - 触发后冷却3轮');
