import { XMLParser, XMLBuilder } from 'fast-xml-parser';

// 解析器配置
const parserConfig = {
    ignoreAttributes: false,
    attributeNamePrefix: "",
    allowBooleanAttributes: true,
    parseTagValue: true,
    isArray: (name, jpath, isLeafNode, isAttribute) => { 
        // 强制将可重复元素转换为数组
        if (name === "Component") return true;
        if (name === "Property") return true;
        if (name === "ReferenceItem") return true;
        return false;
    }
};

// 构建器配置
const builderConfig = {
    ignoreAttributes: false,
    attributeNamePrefix: "",
    format: true,
    indentBy: "  ",
    suppressEmptyNode: true,
};

export const parseVcf = (xmlString) => {
    const parser = new XMLParser(parserConfig);
    const jsonObj = parser.parse(xmlString);
    
    // 规范化结构以便于处理
    // 预期结构：root -> File -> ComponentList -> Component[]
    
    if (!jsonObj.File || !jsonObj.File.ComponentList) {
        throw new Error("Invalid VCF file format");
    }

    const componentList = jsonObj.File.ComponentList.Component || [];
    
    // 处理组件，便于访问属性
    const processedComponents = componentList.map(comp => {
        const propsMap = {};
        if (comp.Properties && comp.Properties.Property) {
            comp.Properties.Property.forEach(prop => {
                propsMap[prop.SymbolName] = prop.Value;
            });
        }
        
        return {
            ...comp,
            _props: propsMap, // 用于快速访问的辅助属性
            // 确保位置属性是数字类型用于3D渲染
            _x: parseFloat(propsMap.X || 0),
            _y: parseFloat(propsMap.Y || 0),
            _angle: parseFloat(propsMap.Angle || 0)
        };
    });

    return {
        raw: jsonObj, // Keep raw for reconstruction
        components: processedComponents
    };
};

export const generateVcf = (originalJson, modifiedComponents) => {
    // 深度复制原始结构以避免数据被修改
    const newJson = JSON.parse(JSON.stringify(originalJson));
    
    // 使用修改后的数据更新原始JSON中的ComponentList
    // 需要将处理后的组件映射回XML结构
    
    const xmlComponents = modifiedComponents.map(comp => {
        // 从_props重建Properties数组（如果需要）
        // 或者依赖UI直接编辑comp对象的Properties.Property数组
        
        // 策略：UI应该同时更新'Properties.Property'数组和'_props'辅助属性
        // 但为了安全起见，如果要支持直接映射编辑，应该从_props同步到Properties.Property
        // 或者假设UI直接编辑原始数组
        
        // 假设UI直接编辑'comp.Properties.Property'数组用于XML结构
        // 在保存前清理内部辅助键
        
        const { _props, _x, _y, _angle, ...xmlComp } = comp;
        
        // 如果空间属性改变则同步回XML属性
        // 这在3D拖拽时至关重要
        if (xmlComp.Properties && xmlComp.Properties.Property) {
            xmlComp.Properties.Property.forEach(prop => {
                if (prop.SymbolName === 'X') prop.Value = _x;
                if (prop.SymbolName === 'Y') prop.Value = _y;
                if (prop.SymbolName === 'Angle') prop.Value = _angle;
                
                // 如果使用_props进行绑定，则同步其他属性
                if (_props && _props[prop.SymbolName] !== undefined) {
                    prop.Value = _props[prop.SymbolName];
                }
            });
        }
        
        return xmlComp;
    });

    newJson.File.ComponentList.Component = xmlComponents;

    const builder = new XMLBuilder(builderConfig);
    const xmlContent = builder.build(newJson);
    
    // 如果缺少XML声明则手动添加（根据版本，fast-xml-parser可能默认不添加）
    return `<?xml version="1.0" encoding="UTF-8"?>\n${xmlContent}`;
};

export const createEmptyVcf = () => {
    // 新文件模板
    return `<?xml version="1.0" encoding="UTF-8"?>
<File xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns="urn:JTSComponentTemplateFile">
<FileInfo FileType="vc" FileRevision="1" FileFormat="100" Description="New AGV Configuration" CreationDate="${new Date().toISOString()}" />
<Identification ArticleNumber="NEW_AGV" Description="New AGV Config" />
<ComponentList Name="NewAGV" TimeStamp="${Math.floor(Date.now() / 1000)}">
    <Component SymbolName="Chassis" DataType="Chassis" Remark="底盘" Index="0">
        <Properties>
            <Property SymbolName="Type" Value="0" Remark="底盘类型"/>
            <Property SymbolName="MaxSpeed" Value="1000" Remark="最大线速度"/>
        </Properties>
    </Component>
</ComponentList>
</File>`;
};

