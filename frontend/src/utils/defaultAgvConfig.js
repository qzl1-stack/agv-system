export const DEFAULT_AGV_CONFIG = `<?xml version="1.0" encoding="UTF-8"?>
<File xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns="urn:JTSComponentTemplateFile">
	<FileInfo FileType="vc" FileRevision="1" FileFormat="100" Description="JTS Vehicle Component File" CreationDate="2019-12-05" CreationTime="11:42:25.4011546+08:00" CreatedBy="huzheng" ModificationDate="2019-12-05" ModificationTime="11:42:25.4011546+08:00" ModifiedBy="JTCS" ModifiedWith="P41716V3.2.0.14233" ModifiedWithSerial="35950"/>
	<Identification ArticleNumber="P41975V2.1.0" ArticleNumberMatch="P41975V2\\.1\\..*" Description="JTS 2.11 - Standard Vehicle, P41975V2.1.0 (HW 18446-01)"/>
	<ComponentList Name="P41975" TimeStamp="1575546161">
		<Component SymbolName="Chassis" DataType="Chassis" Remark="底盘" Index="0">
			<Properties>
				<Property SymbolName="Type" Value="0" Remark="底盘类型: 0,diff; 1:sd; 2,quad"/>
				<Property SymbolName="MaxSpeed" Value="2000" Remark="最大线速度速度"/>
				<Property SymbolName="MaxAngularSpeed" Value="90" Remark="最大角速度"/>
				<Property SymbolName="SlowDownSpeed" Value="300" Remark="减速速度"/>
				<Property SymbolName="CreepSpeed" Value="40" Remark="爬行速度"/>
				<Property SymbolName="CreepDistance" Value="100" Remark="爬行距离"/>
				<Property SymbolName="AccSlope" Value="500" Remark="线性加速度"/>
				<Property SymbolName="DecSlope" Value="500" Remark="线性减速度"/>
				<Property SymbolName="EmcyDecSlope" Value="1000" Remark="线性紧急停止减速度"/>
				<Property SymbolName="AngularAccSlope" Value="10" Remark="旋转角加速度"/>
				<Property SymbolName="AngularDecSlope" Value="50" Remark="旋转角减速度"/>
				<Property SymbolName="AngularemcyEmcyDecSlope" Value="100" Remark="旋转紧急停止角减速度"/>
			</Properties>
			<References>
				<Reference SymbolName="Wheels">
					<ReferenceItem Value="LeftWheel"/>
					<ReferenceItem Value="RightWheel"/>
				</Reference>
			</References>
		</Component>
		<Component SymbolName="LeftWheel" DataType="WheelSD" Remark="驱动轮" Index="1">
			<Properties>
				<Property SymbolName="WheelType" Value="Drive" Remark="驱动轮类型: 可以是Steer, Drive 或 SD"/>
				<Property SymbolName="MaxAngularSpeed" Value="90" Remark="最大舵机速度"/>
				<Property SymbolName="MinSteerAngle" Value="-90" Remark="最小舵机转角"/>
				<Property SymbolName="MaxSteerAngle" Value="90" Remark="最大舵机转角"/>
				<Property SymbolName="MaxSpeed" Value="3000" Remark="最大驱动轮速度"/>
				<Property SymbolName="X" Value="0" Remark="驱动轮中心在车辆坐标系中X方向距离"/>
				<Property SymbolName="Y" Value="180" Remark="驱动轮中心在车辆坐标系中Y方向距离"/>
				<Property SymbolName="SteerName" Value="NotUsed" Remark="转向驱动"/>
				<Property SymbolName="DriveName" Value="Mcu2_1" Remark="行走驱动"/>
			</Properties>
		</Component>
		<Component SymbolName="RightWheel" DataType="WheelSD" Remark="驱动轮" Index="2">
			<Properties>
				<Property SymbolName="WheelType" Value="Drive" Remark="驱动轮类型: 可以是Steer, Drive 或 SD"/>
				<Property SymbolName="MaxAngularSpeed" Value="90" Remark="最大舵机速度"/>
				<Property SymbolName="MinSteerAngle" Value="-90" Remark="最小舵机转角"/>
				<Property SymbolName="MaxSteerAngle" Value="90" Remark="最大舵机转角"/>
				<Property SymbolName="MaxSpeed" Value="3000" Remark="最大驱动轮速度"/>
				<Property SymbolName="X" Value="0" Remark="驱动轮中心在车辆坐标系中X方向距离"/>
				<Property SymbolName="Y" Value="-180" Remark="驱动轮中心在车辆坐标系中Y方向距离"/>
				<Property SymbolName="SteerName" Value="NotUsed" Remark="转向驱动"/>
				<Property SymbolName="DriveName" Value="Mcu2_2" Remark="行走驱动"/>
			</Properties>
		</Component>
		<Component SymbolName="SlamNavigator" DataType="SlamNavigator" Remark="SLAM导航器" Index="3">
			<Properties>
				<Property SymbolName="Open" Value="1" Remark="0:Close; 1:Open"/>
				<Property SymbolName="SensorNames" Value="" Remark="激光雷达传感器"/>
				<Property SymbolName="Method" Value="2" Remark="SLAM导航器工作模式 0:none; 1:build; 2:location"/>
				<Property SymbolName="IsUseImu" Value="1" Remark="是否使用IMU"/>
				<Property SymbolName="IsUseOdom" Value="1" Remark="是否使用里程计"/>
				<Property SymbolName="IsUseLandMark" Value="1" Remark="是否使用LandMark"/>
				<Property SymbolName="IsSetInitPose" Value="0" Remark="是否设置初始位置"/>
				<Property SymbolName="IsReadInitPose" Value="0" Remark="是否设置初始位置"/>
				<Property SymbolName="InitPoseX" Value="0" Remark="初始位置x"/>
				<Property SymbolName="InitPoseY" Value="0" Remark="初始位置y"/>
				<Property SymbolName="InitPosePhi" Value="0" Remark="初始位置角度"/>
				<Property SymbolName="FilterTime" Value="500" Remark="Set Filter Time(ms):  time"/>
				<Property SymbolName="FilterCount" Value="4" Remark="Set Filter Count: count"/>
				<Property SymbolName="FilterSize" Value="5.0" Remark="Set Filter Size: time/size"/>
				<Property SymbolName="FilterWeight" Value="0.25" Remark="Set Filter Weight: time/weight"/>
				<Property SymbolName="MapPath" Value="JTCSTest_0726.pbstream" Remark="map load or save file path"/>
				<Property SymbolName="MapOffsetX" Value="9700" Remark="map offset x(mm)"/>
				<Property SymbolName="MapOffsetY" Value="10075" Remark="map offset y(mm)"/>
				<Property SymbolName="MapOffsetPhi" Value="17900" Remark="map offset angle(0.01°)"/>
				<Property SymbolName="BagMethod" Value="0" Remark="0:none; 1:read; 2:write"/>
				<Property SymbolName="BagPath" Value="data_cs_0910.bag" Remark="Bag file path"/>
			</Properties>
			<References>
				<Reference SymbolName="LaserScanners">
					<ReferenceItem Value="PepperlFuchsR2000_1"/>
				</Reference>
			</References>
		</Component>
		<Component SymbolName="PepperlFuchsR2000_1" DataType="PepperlFuchsR2000" Remark="倍加福激光雷达R2000" Index="4">
			<Properties>
				<Property SymbolName="IP" Value="192.168.100.9" Remark="雷达的IP地址"/>
				<Property SymbolName="Port" Value="80" Remark="雷达端口"/>
				<Property SymbolName="X" Value="0" Remark="传感器X方向安装位置mm"/>
				<Property SymbolName="Y" Value="0" Remark="传感器Y方向安装位置mm"/>
				<Property SymbolName="Angle" Value="0" Remark="传感器安装位置角度(0.01°)"/>
				<Property SymbolName="ScanFrequency" Value="20" Remark="雷达频率/HZ"/>
				<Property SymbolName="SamplesPerScan" Value="2400" Remark="雷达采样率/per"/>
				<Property SymbolName="ScanAngleMin" Value="0" Remark="雷达最小角度(0.01°)"/>
				<Property SymbolName="ScanAngleMax" Value="0" Remark="雷达最大角度(0.01°)"/>
				<Property SymbolName="StopDistanceX" Value="0" Remark="雷达前后急停距离mm"/>
				<Property SymbolName="StopDistanceY" Value="0" Remark="雷达左右急停距离mm"/>
				<Property SymbolName="Upside" Value="0" Remark="雷达是否翻转"/>
				<Property SymbolName="Log" Value="0" Remark="雷达数据记录"/>
			</Properties>
		</Component>
		<Component SymbolName="BarcodeNavigator" DataType="BarcodeNavigator" Remark="二维码导航器" Index="6">
			<Properties>
				<Property SymbolName="MaxMarkerDistance" Value="1500" Remark="定位二维码传感器名称"/>
			</Properties>
			<References>
				<Reference SymbolName="BarcodeSensor">
					<ReferenceItem Value="IraypleR3138MG010_0"/>
				</Reference>
			</References>
		</Component>
		<Component SymbolName="Sc2000a_0" DataType="Sc2000a" Remark="海康二维码传感器" Index="7">
			<Properties>
				<Property SymbolName="Type" Value="1" Remark="0,普通; 1,导航传感器"/>
				<Property SymbolName="X" Value="0" Remark="传感器X方向安装位置"/>
				<Property SymbolName="Y" Value="0" Remark="传感器Y方向安装位置"/>
				<Property SymbolName="Angle" Value="00" Remark="传感器安装位置角度"/>
			</Properties>
			<References>
				<Reference SymbolName="Port">
					<ReferenceItem Value="LAN"/>
				</Reference>
			</References>
		</Component>
		<Component SymbolName="IraypleR3138MG010_0" DataType="IraypleR3138MG010" BaseType="GenericCanDevice" Index="0x202F" FixedIndex="0">
			<Properties>
				<Property SymbolName="Type" Value="1" Remark="0,货架定位; 1,导航" />
				<Property SymbolName="IP" Value="192.168.100.8" Remark="传感器IP" />
				<Property SymbolName="Port" Value="3000" Remark="传感器端口" />
				<Property SymbolName="X" Value="0" Remark="传感器X方向安装位置" />
				<Property SymbolName="Y" Value="0" Remark="传感器Y方向安装位置" />
				<Property SymbolName="Angle" Value="17990" Remark="传感器安装位置角度传感器安装位置角度,车偏左-，车偏右+" />
			</Properties>
			<References>
				<Reference SymbolName="Port">
					<ReferenceItem Value="LAN" />
				</Reference>
			</References>
		</Component>
		<Component SymbolName="IraypleR3138MG010_1" DataType="IraypleR3138MG010" BaseType="GenericCanDevice" Index="0x202F" FixedIndex="0">
			<Properties>
				<Property SymbolName="Type" Value="0" Remark="0,货架定位; 1,导航" />
				<Property SymbolName="IP" Value="192.168.100.7" Remark="传感器IP" />
				<Property SymbolName="Port" Value="3000" Remark="传感器端口" />
				<Property SymbolName="X" Value="0" Remark="传感器X方向安装位置" />
				<Property SymbolName="Y" Value="0" Remark="传感器Y方向安装位置" />
				<Property SymbolName="Angle" Value="00" Remark="传感器安装位置角度" />
			</Properties>
			<References>
				<Reference SymbolName="Port">
					<ReferenceItem Value="LAN" />
				</Reference>
			</References>
		</Component>
		<Component SymbolName="VehicleNavigator" DataType="VehicleNavigator" Remark="车辆导航器" Index="8">
			<Properties>
				<Property SymbolName="StartupNavMethod" Value="4" Remark="启动导航方式. 1 = reflector, 2 = spot, 3 = slam, 4 = barcode"/>
			</Properties>
			<References>
				<Reference SymbolName="Navigators">
					<ReferenceItem Value="SlamNavigator"/>
					<ReferenceItem Value="BarcodeNavigator"/>
				</Reference>
			</References>
		</Component>
		<Component SymbolName="CANBus1" DataType="CANBus" Remark="CAN总线" Index="9">
			<Properties>
				<Property SymbolName="BusID" Value="1" Remark="Physical CAN ID"/>
				<Property SymbolName="Bitrate" Value="500" Remark="Bitrate (kBit/s)"/>
			</Properties>
		</Component>
		<Component SymbolName="CANBus2" DataType="CANBus" Remark="CAN总线" Index="10">
			<Properties>
				<Property SymbolName="BusID" Value="2" Remark="Physical CAN ID"/>
				<Property SymbolName="Bitrate" Value="500" Remark="Bitrate (kBit/s)"/>
			</Properties>
		</Component>
		<Component SymbolName="COM1" DataType="SerialPort_RS232" Remark="RS232接口" Index="11">
			<Properties>
				<Property SymbolName="Port" Value="COM1" Remark="串口号"/>
				<Property SymbolName="Baudrate" Value="115200" Remark="波特率 (bits/second)"/>
				<Property SymbolName="Databits" Value="8" Remark="数据位"/>
				<Property SymbolName="Parity" Value="None" Remark="校验位 (None, Even, Odd)"/>
				<Property SymbolName="Stopbits" Value="1" Remark="停止位"/>
			</Properties>
		</Component>
		<Component SymbolName="COM2" DataType="SerialPort_RS485" Remark="RS485接口" Index="12">
			<Properties>
				<Property SymbolName="Baudrate" Value="115200" Remark="波特率 (bits/second)"/>
				<Property SymbolName="Port" Value="COM2" Remark="串口号"/>
				<Property SymbolName="Databits" Value="8" Remark="数据位"/>
				<Property SymbolName="Parity" Value="None" Remark="校验位 (None, Even, Odd)"/>
				<Property SymbolName="Stopbits" Value="1" Remark="停止位"/>
			</Properties>
		</Component>
		<Component SymbolName="COM3" DataType="SerialPort_RS485" Remark="RS485接口" Index="13">
			<Properties>
				<Property SymbolName="Port" Value="COM3" Remark="串口号"/>
				<Property SymbolName="Baudrate" Value="115200" Remark="波特率 (bits/second)"/>
				<Property SymbolName="Databits" Value="8" Remark="数据位"/>
				<Property SymbolName="Parity" Value="Even" Remark="校验位 (None, Even, Odd)"/>
				<Property SymbolName="Stopbits" Value="1" Remark="停止位"/>
			</Properties>
		</Component>
		<Component SymbolName="COM4" DataType="SerialPort_RS485" Remark="RS485接口" Index="14">
			<Properties>
				<Property SymbolName="Port" Value="COM4" Remark="串口号"/>
				<Property SymbolName="Baudrate" Value="115200" Remark="波特率 (bits/second)"/>
				<Property SymbolName="Databits" Value="8" Remark="数据位"/>
				<Property SymbolName="Parity" Value="None" Remark="校验位 (None, Even, Odd)"/>
				<Property SymbolName="Stopbits" Value="1" Remark="停止位"/>
			</Properties>
		</Component>
		<Component SymbolName="LAN1" DataType="LAN" Remark="以太网接口" Index="14">
			<Properties>
				<Property SymbolName="Device" Value="net0" Remark="网口名称" />
				<Property SymbolName="IP" Value="192.168.100.100/24" Remark="主控ip地址" />
				<Property SymbolName="IP1" Value="" Remark="主控ip地址1" />
				<Property SymbolName="IP2" Value="" Remark="主控ip地址2" />
				<Property SymbolName="IP3" Value="" Remark="主控ip地址3" />
				<Property SymbolName="IP4" Value="" Remark="主控ip地址4" />
			</Properties>
		</Component>
		<Component SymbolName="LAN2" DataType="LAN" Remark="以太网接口" Index="14">
			<Properties>
				<Property SymbolName="Device" Value="" Remark="网口名称" />
				<Property SymbolName="IP" Value="" Remark="主控ip地址" />
				<Property SymbolName="IP1" Value="" Remark="主控ip地址1" />
				<Property SymbolName="IP2" Value="" Remark="主控ip地址2" />
				<Property SymbolName="IP3" Value="" Remark="主控ip地址3" />
				<Property SymbolName="IP4" Value="" Remark="主控ip地址4" />
			</Properties>
		</Component>
		<Component SymbolName="Guidance" DataType="Guidance" Remark="导引模块" Index="15">
			<Properties>
				<Property SymbolName="SafetyZoneX" Value="100" Remark="路径端点偏离安全值"/>
				<Property SymbolName="SafetyZoneY" Value="100" Remark="横向安全区距离值"/>
				<Property SymbolName="SafetyZoneTh" Value="10" Remark="角度安全值"/>
				<Property SymbolName="LateralWeight" Value="1" Remark="横向权重"/>
				<Property SymbolName="HeadingWeight" Value="1" Remark="角度权重"/>
				<Property SymbolName="DevX" Value="0" Remark="偏离路径端点值"/>
				<Property SymbolName="DevY" Value="0" Remark="横向偏离路径值"/>
				<Property SymbolName="DevAngle" Value="0" Remark="角度偏离值"/>
				<Property SymbolName="DistanceToStop" Value="0" Remark="距离停止点的距离"/>
			</Properties>
		</Component>
		<Component SymbolName="Mcd" DataType="Mcd" Remark="手动控制器" Index="16">
			<Properties>
				<Property SymbolName="Speed" Value="0" Remark="手动控制器速度值"/>
				<Property SymbolName="Angle" Value="0" Remark="手动控制器角度值"/>
				<Property SymbolName="Buttons" Value="0" Remark="手动控制器按钮状态"/>
				<Property SymbolName="Button1" Value="0" Remark="Auto mode 按钮"/>
				<Property SymbolName="Button2" Value="0" Remark="Semi mode 按钮"/>
				<Property SymbolName="Button3" Value="0" Remark="Man mode 按钮"/>
				<Property SymbolName="Button4" Value="0" Remark="Forward backward 按钮"/>
				<Property SymbolName="Button5" Value="0" Remark="Low speed 按钮"/>
				<Property SymbolName="Button6" Value="0" Remark="High speed 按钮"/>
				<Property SymbolName="Button7" Value="0" Remark="Override 按钮"/>
				<Property SymbolName="Button8" Value="0" Remark="Load1 up 按钮"/>
				<Property SymbolName="Button9" Value="0" Remark="Load1 down 按钮"/>
				<Property SymbolName="Button10" Value="0" Remark="Load2 left 按钮"/>
				<Property SymbolName="Button11" Value="0" Remark="Load2 right 按钮"/>
				<Property SymbolName="HighSpeed" Value="800" Remark="高速按钮速度"/>
				<Property SymbolName="LowSpeed" Value="50" Remark="低速按钮速度"/>
				<Property SymbolName="Valid" Value="0" Remark="MCD状态:0,未连接; 1,已连接"/>
			</Properties>
			<References>
				<Reference SymbolName="Port">
					<ReferenceItem Value="COM2"/>
				</Reference>
			</References>
		</Component>
		<Component SymbolName="D011002V100_1" DataType="D011002V100" Remark="步科电机驱动" Index="17">
			<Properties>
				<Property SymbolName="BusID" Value="2" Remark="总线ID"/>
				<Property SymbolName="NodeID" Value="1" Remark="节点ID"/>
				<Property SymbolName="DriveEncScale" Value="1738370" Remark="轮子每米脉冲数"/>
				<Property SymbolName="MotorPulsePerRevolution" Value="65535" Remark="电机每转脉冲数"/>
				<Property SymbolName="ReverseSetSpeed" Value="1" Remark="设定速度反向：0不反向，1反向"/>
				<Property SymbolName="ReverseMeasuredSpeed" Value="1" Remark="测量速度反向：0不反向，1反向"/>
				<Property SymbolName="ReverseDistance" Value="1" Remark="里程反向：0不反向，1反向"/>
				<Property SymbolName="SetSpeed" Value="0" Remark="设定速度"/>
				<Property SymbolName="Distance" Value="0" Remark="测量里程"/>
				<Property SymbolName="MeasuredSpeed" Value="0" Remark="测量速度"/>
			</Properties>
		</Component>
		<Component SymbolName="D011002V100_2" DataType="D011002V100" Remark="步科电机驱动" Index="18">
			<Properties>
				<Property SymbolName="BusID" Value="2" Remark="总线ID"/>
				<Property SymbolName="NodeID" Value="2" Remark="节点ID"/>
				<Property SymbolName="DriveEncScale" Value="1738370" Remark="轮子每米脉冲数"/>
				<Property SymbolName="MotorPulsePerRevolution" Value="65535" Remark="电机每转脉冲数"/>
				<Property SymbolName="ReverseSetSpeed" Value="0" Remark="设定速度反向：0不反向，1反向"/>
				<Property SymbolName="ReverseMeasuredSpeed" Value="0" Remark="测量速度反向：0不反向，1反向"/>
				<Property SymbolName="ReverseDistance" Value="0" Remark="里程反向：0不反向，1反向"/>
				<Property SymbolName="SetSpeed" Value="0" Remark="设定速度"/>
				<Property SymbolName="Distance" Value="0" Remark="测量里程"/>
				<Property SymbolName="MeasuredSpeed" Value="0" Remark="测量速度"/>
			</Properties>
		</Component>
		<Component SymbolName="D011003V100_4" DataType="D011003V100" Remark="天太电机驱动" Index="18">
			<Properties>
				<Property SymbolName="BusID" Value="2" Remark="总线ID"/>
				<Property SymbolName="NodeID" Value="2" Remark="节点ID"/>
				<Property SymbolName="DriveEncScale" Value="834430" Remark="轮子每米脉冲数"/>
				<Property SymbolName="MotorPulsePerRevolution" Value="32768" Remark="电机每转脉冲数"/>
				<Property SymbolName="ReverseSetSpeed" Value="0" Remark="设定速度反向：0不反向，1反向"/>
				<Property SymbolName="ReverseMeasuredSpeed" Value="0" Remark="测量速度反向：0不反向，1反向"/>
				<Property SymbolName="ReverseDistance" Value="0" Remark="里程反向：0不反向，1反向"/>
				<Property SymbolName="SetSpeed" Value="0" Remark="设定速度"/>
				<Property SymbolName="Distance" Value="0" Remark="测量里程"/>
				<Property SymbolName="MeasuredSpeed" Value="0" Remark="测量速度"/>
			</Properties>
		</Component>
		<Component SymbolName="D011003V100_1" DataType="D011003V100" Remark="天太电机驱动" Index="17">
			<Properties>
				<Property SymbolName="BusID" Value="2" Remark="总线ID"/>
				<Property SymbolName="NodeID" Value="1" Remark="节点ID"/>
				<Property SymbolName="DriveEncScale" Value="834430" Remark="轮子每米脉冲数"/>
				<Property SymbolName="MotorPulsePerRevolution" Value="32768" Remark="电机每转脉冲数"/>
				<Property SymbolName="ReverseSetSpeed" Value="1" Remark="设定速度反向：0不反向，1反向"/>
				<Property SymbolName="ReverseMeasuredSpeed" Value="1" Remark="测量速度反向：0不反向，1反向"/>
				<Property SymbolName="ReverseDistance" Value="1" Remark="里程反向：0不反向，1反向"/>
				<Property SymbolName="SetSpeed" Value="0" Remark="设定速度"/>
				<Property SymbolName="Distance" Value="0" Remark="测量里程"/>
				<Property SymbolName="MeasuredSpeed" Value="0" Remark="测量速度"/>
			</Properties>
		</Component>
		<Component SymbolName="D011003V100_2" DataType="D011003V100" Remark="天太电机驱动" Index="18">
			<Properties>
				<Property SymbolName="BusID" Value="2" Remark="总线ID"/>
				<Property SymbolName="NodeID" Value="2" Remark="节点ID"/>
				<Property SymbolName="DriveEncScale" Value="834430" Remark="轮子每米脉冲数"/>
				<Property SymbolName="MotorPulsePerRevolution" Value="32768" Remark="电机每转脉冲数"/>
				<Property SymbolName="ReverseSetSpeed" Value="0" Remark="设定速度反向：0不反向，1反向"/>
				<Property SymbolName="ReverseMeasuredSpeed" Value="0" Remark="测量速度反向：0不反向，1反向"/>
				<Property SymbolName="ReverseDistance" Value="0" Remark="里程反向：0不反向，1反向"/>
				<Property SymbolName="SetSpeed" Value="0" Remark="设定速度"/>
				<Property SymbolName="Distance" Value="0" Remark="测量里程"/>
				<Property SymbolName="MeasuredSpeed" Value="0" Remark="测量速度"/>
			</Properties>
		</Component>
		<Component SymbolName="Pio100_1" DataType="Pio100" Remark="面板IO" Index="18">
			<Properties>
				<Property SymbolName="BusID" Value="1" Remark="总线ID"/>
			</Properties>
		</Component>
		<Component SymbolName="Pio100_2" DataType="Pio100" Remark="面板IO" Index="18">
			<Properties>
				<Property SymbolName="BusID" Value="1" Remark="总线ID"/>
			</Properties>
		</Component>
	</ComponentList>
</File>`;
